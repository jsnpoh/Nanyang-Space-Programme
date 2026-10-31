"""XGBoost models and test-set predictions for event-level collision risk."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier, XGBRegressor

from data_loader import CATEGORICAL_FEATURES, MODEL_FEATURES, NUMERIC_FEATURES
from risk_policy import TIERS, classify_risk, tier_from_code

MODEL_VERSION = "xgb-event-risk-v1"
LOW_CONFIDENCE_THRESHOLD = 0.60


def _features(events: pd.DataFrame) -> pd.DataFrame:
    missing = [column for column in MODEL_FEATURES if column not in events]
    if missing:
        raise ValueError(f"Model input is missing: {', '.join(missing)}.")
    features = events.loc[:, MODEL_FEATURES].copy()
    for column in NUMERIC_FEATURES:
        features[column] = pd.to_numeric(features[column], errors="coerce")
    for column in CATEGORICAL_FEATURES:
        features[column] = features[column].fillna("UNKNOWN").astype(str)
    return features


def _preprocessor() -> ColumnTransformer:
    numeric = Pipeline(
        steps=[("impute", SimpleImputer(strategy="median", add_indicator=True))]
    )
    categorical = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="constant", fill_value="UNKNOWN")),
            ("encode", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric, list(NUMERIC_FEATURES)),
            ("categorical", categorical, list(CATEGORICAL_FEATURES)),
        ],
        remainder="drop",
    )


def _regressor(seed: int = 42) -> Pipeline:
    return Pipeline(
        steps=[
            ("features", _preprocessor()),
            (
                "model",
                XGBRegressor(
                    objective="reg:squarederror",
                    n_estimators=180,
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    reg_lambda=1.5,
                    tree_method="hist",
                    n_jobs=4,
                    random_state=seed,
                ),
            ),
        ]
    )


def _classifier(seed: int = 42) -> Pipeline:
    return Pipeline(
        steps=[
            ("features", _preprocessor()),
            (
                "model",
                XGBClassifier(
                    objective="multi:softprob",
                    num_class=len(TIERS),
                    eval_metric="mlogloss",
                    n_estimators=180,
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    reg_lambda=1.5,
                    tree_method="hist",
                    n_jobs=4,
                    random_state=seed,
                ),
            ),
        ]
    )


def fit_models(events: pd.DataFrame, seed: int = 42) -> dict[str, Any]:
    """Fit the final-risk regressor and class-balanced final-tier classifier."""
    if events.empty:
        raise ValueError("Cannot fit models on an empty event table.")
    x = _features(events)
    risk = pd.to_numeric(events["risk"], errors="coerce")
    if risk.isna().any():
        raise ValueError("Training labels contain missing final risk values.")
    tier_codes = events["tier"].map({tier: index for index, tier in enumerate(TIERS)})
    if tier_codes.isna().any() or set(tier_codes.astype(int)) != set(range(len(TIERS))):
        raise ValueError("Training data must include all three known risk tiers.")

    regressor = _regressor(seed)
    classifier = _classifier(seed)
    class_counts = tier_codes.value_counts()
    sample_weights = tier_codes.map(
        {code: len(tier_codes) / (len(TIERS) * count) for code, count in class_counts.items()}
    )
    regressor.fit(x, risk)
    classifier.fit(x, tier_codes.astype(int), model__sample_weight=sample_weights)
    return {
        "version": MODEL_VERSION,
        "regressor": regressor,
        "classifier": classifier,
        "risk_min": float(risk.min()),
        "risk_max": float(risk.max()),
        "training_events": int(len(events)),
        "training_tier_counts": {
            tier: int((events["tier"] == tier).sum()) for tier in TIERS
        },
    }


def predict_events(
    models: dict[str, Any], events: pd.DataFrame
) -> pd.DataFrame:
    """Predict final outcomes; uncertain cases fall back to deterministic rules."""
    if events.empty:
        return pd.DataFrame()
    x = _features(events)
    predicted_risk = np.asarray(models["regressor"].predict(x), dtype=float)
    probability_matrix = np.asarray(models["classifier"].predict_proba(x), dtype=float)
    classifier = models["classifier"].named_steps["model"]
    code_order = [int(code) for code in classifier.classes_]
    output = events.copy().reset_index(drop=True)
    output["predicted_risk_log10_pc"] = predicted_risk
    output["baseline_risk_log10_pc"] = pd.to_numeric(
        output["max_risk_estimate"], errors="coerce"
    )
    output["ml_predicted_tier"] = ""
    output["predicted_tier"] = ""
    output["baseline_tier"] = ""
    output["classifier_score"] = np.nan
    for tier in TIERS:
        output[f"probability_{tier}"] = np.nan
    output["fallback_used"] = False
    output["manual_review_required"] = False
    output["manual_review_reasons"] = ""

    for index, row in output.iterrows():
        probabilities = {
            tier_from_code(code): float(probability_matrix[index, column])
            for column, code in enumerate(code_order)
        }
        ml_tier = max(probabilities, key=probabilities.get)
        confidence = probabilities[ml_tier]
        baseline_tier = classify_risk(
            row["baseline_risk_log10_pc"], row["miss_distance"]
        )
        missing = [
            feature
            for feature in MODEL_FEATURES
            if pd.isna(row[feature]) or str(row[feature]).strip() == ""
        ]
        invalid_prediction = not np.isfinite(predicted_risk[index])
        use_fallback = (
            confidence < LOW_CONFIDENCE_THRESHOLD
            or invalid_prediction
            or "miss_distance" in missing
            or "max_risk_estimate" in missing
            or ml_tier != baseline_tier
        )
        selected_tier = baseline_tier if use_fallback else ml_tier
        reasons = []
        if confidence < LOW_CONFIDENCE_THRESHOLD:
            reasons.append("classifier confidence below 0.60")
        if invalid_prediction:
            reasons.append("regression output was not finite")
        if "miss_distance" in missing or "max_risk_estimate" in missing:
            reasons.append("rule-fallback input is missing")
        if ml_tier != baseline_tier:
            reasons.append(
                "ML tier disagrees with deterministic max_risk_estimate baseline; baseline used"
            )
        if missing:
            reasons.append(f"imputed features: {', '.join(missing)}")
        if float(row["time_to_tca"]) <= 1:
            reasons.append("TCA is within 24 hours")
        if pd.notna(row["miss_distance"]) and float(row["miss_distance"]) <= 5_000:
            reasons.append("observed miss distance is within 5 km")

        output.at[index, "ml_predicted_tier"] = ml_tier
        output.at[index, "predicted_tier"] = selected_tier
        output.at[index, "baseline_tier"] = baseline_tier
        output.at[index, "classifier_score"] = confidence
        output.at[index, "probability_safe"] = probabilities["safe"]
        output.at[index, "probability_elevated"] = probabilities["elevated"]
        output.at[index, "probability_critical"] = probabilities["critical"]
        output.at[index, "fallback_used"] = use_fallback
        output.at[index, "manual_review_required"] = bool(reasons)
        output.at[index, "manual_review_reasons"] = "; ".join(reasons)
    output["manual_review_required"] = output["manual_review_required"].astype(bool)
    output["fallback_used"] = output["fallback_used"].astype(bool)
    return output


def evaluate_regressor(
    actual: pd.Series, predicted: pd.Series
) -> dict[str, float]:
    """Regression metrics kept separate so the same protocol scores both models."""
    actual_values = np.asarray(actual, dtype=float)
    predicted_values = np.asarray(predicted, dtype=float)
    errors = predicted_values - actual_values
    return {
        "mae": float(np.mean(np.abs(errors))),
        "rmse": float(np.sqrt(np.mean(np.square(errors)))),
        "r2": float(1 - np.sum(np.square(errors)) / np.sum(np.square(actual_values - actual_values.mean()))),
    }
