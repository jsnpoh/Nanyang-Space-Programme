"""Grouped validation, deterministic baselines, warning filters, and audit reports."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import StratifiedGroupKFold

from data_loader import EVENT_ID
from model_engine import evaluate_regressor, fit_models, predict_events
from risk_policy import TIERS, classify_risk


def _tier_metrics(actual: pd.Series, predicted: pd.Series) -> dict[str, Any]:
    labels = list(TIERS)
    return {
        "accuracy": float(accuracy_score(actual, predicted)),
        "balanced_accuracy": float(
            balanced_accuracy_score(actual, predicted)
        ),
        "per_class": classification_report(
            actual,
            predicted,
            labels=labels,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(
            actual, predicted, labels=labels
        ).tolist(),
    }


def evaluate_holdout(events: pd.DataFrame, seed: int = 42) -> dict[str, Any]:
    """Evaluate on a deterministic, event-disjoint 20% training fold."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    train_indices, validation_indices = next(
        splitter.split(events, events["tier"], groups=events[EVENT_ID])
    )
    train = events.iloc[train_indices].reset_index(drop=True)
    validation = events.iloc[validation_indices].reset_index(drop=True)
    if set(train[EVENT_ID]).intersection(validation[EVENT_ID]):
        raise RuntimeError("Event leakage detected in validation split.")

    models = fit_models(train, seed)
    validation_predictions = predict_events(models, validation)
    actual_risk = validation["risk"].astype(float).reset_index(drop=True)
    model_risk = validation_predictions["predicted_risk_log10_pc"].astype(float)
    baseline_risk = validation_predictions["baseline_risk_log10_pc"].astype(float)

    actual_tier = validation["tier"].reset_index(drop=True)
    model_tier = validation_predictions["ml_predicted_tier"].reset_index(drop=True)
    baseline_tier = pd.Series(
        [
            classify_risk(risk, distance)
            for risk, distance in zip(
                baseline_risk,
                validation["miss_distance"],
                strict=True,
            )
        ],
        name="baseline_tier",
    )
    model_tier_metrics = _tier_metrics(actual_tier, model_tier)
    baseline_tier_metrics = _tier_metrics(actual_tier, baseline_tier)
    comparison = validation.loc[
        :,
        [
            EVENT_ID,
            "risk",
            "tier",
            "miss_distance",
            "final_miss_distance_m",
            "time_to_tca",
            "max_risk_estimate",
        ],
    ].reset_index(drop=True)
    comparison["predicted_risk_log10_pc"] = model_risk
    comparison["baseline_risk_log10_pc"] = baseline_risk
    comparison["predicted_tier"] = model_tier
    comparison["baseline_tier"] = baseline_tier
    comparison["classifier_score"] = validation_predictions["classifier_score"]
    comparison["correct"] = comparison["tier"].eq(comparison["predicted_tier"])

    critical_misses = comparison.loc[
        comparison["tier"].eq("critical")
        & ~comparison["predicted_tier"].eq("critical")
    ].copy()
    critical_misses["confidence"] = comparison.loc[
        critical_misses.index, "classifier_score"
    ]
    critical_misses = critical_misses.sort_values(
        ["confidence", "miss_distance"], ascending=[True, True]
    )
    failures = comparison.loc[~comparison["correct"]].copy()
    failures["failure_priority"] = failures["tier"].map(
        {"critical": 0, "elevated": 1, "safe": 2}
    )
    failures = failures.sort_values(
        ["failure_priority", "classifier_score"], ascending=[True, True]
    )

    return {
        "seed": seed,
        "train_events": int(len(train)),
        "validation_events": int(len(validation)),
        "train_event_ids": int(train[EVENT_ID].nunique()),
        "validation_event_ids": int(validation[EVENT_ID].nunique()),
        "regression": {
            "model": evaluate_regressor(actual_risk, model_risk),
            "baseline_max_risk_estimate": evaluate_regressor(
                actual_risk, baseline_risk
            ),
        },
        "classification": {
            "model": model_tier_metrics,
            "baseline_max_risk_estimate": baseline_tier_metrics,
        },
        "validation_rows": comparison,
        "critical_misses": critical_misses,
        "failures": failures,
    }


def warning_events(predictions: pd.DataFrame, horizon_days: float = 1.0) -> pd.DataFrame:
    """Deduplicate predictions to the nearest qualifying CDM and omit Safe events."""
    if predictions.empty:
        return predictions.copy()
    mask = (
        predictions["time_to_tca"].ge(0)
        & predictions["time_to_tca"].le(horizon_days)
        & predictions["predicted_tier"].ne("safe")
    )
    filtered = predictions.loc[mask].copy()
    sort_by = ["time_to_tca"]
    ascending = [True]
    if "predicted_risk_log10_pc" in filtered:
        sort_by.append("predicted_risk_log10_pc")
        ascending.append(False)
    return filtered.sort_values(sort_by, ascending=ascending)


def screen_current_cdms(
    cdms: pd.DataFrame, horizon_days: float = 1.0
) -> pd.DataFrame:
    """Apply deterministic current-CDM rules inside the real 24-hour warning window."""
    required = {EVENT_ID, "time_to_tca", "miss_distance"}
    missing_columns = required - set(cdms.columns)
    if missing_columns:
        raise ValueError(
            "Operational CDM CSV is missing warning fields: "
            + ", ".join(sorted(missing_columns))
            + "."
        )
    if "risk" not in cdms and "max_risk_estimate" not in cdms:
        raise ValueError(
            "Operational CDM CSV must include risk or max_risk_estimate for rule screening."
        )
    source_field = "risk" if "risk" in cdms else "max_risk_estimate"
    window = cdms.loc[
        cdms["time_to_tca"].ge(0) & cdms["time_to_tca"].le(horizon_days)
    ].copy()
    if window.empty:
        return window.assign(
            screened_tier=pd.Series(dtype="object"),
            manual_review_required=pd.Series(dtype="bool"),
            manual_review_reasons=pd.Series(dtype="object"),
            screening_risk_source=pd.Series(dtype="object"),
        )
    window["screened_tier"] = [
        classify_risk(risk, distance)
        for risk, distance in zip(
            window[source_field], window["miss_distance"], strict=True
        )
    ]
    window["screening_risk_source"] = source_field
    missing_measurements = window[source_field].isna() | window["miss_distance"].isna()
    window["manual_review_required"] = (
        window["screened_tier"].ne("safe") | missing_measurements
    )
    window["manual_review_reasons"] = [
        "; ".join(
            reason
            for reason, active in (
                ("deterministic current-CDM rule is Elevated or Critical", tier != "safe"),
                ("risk input is missing", pd.isna(risk)),
                ("miss-distance input is missing", pd.isna(distance)),
            )
            if active
        )
        for tier, risk, distance in zip(
            window["screened_tier"],
            window[source_field],
            window["miss_distance"],
            strict=True,
        )
    ]
    return (
        window.sort_values(["time_to_tca"], ascending=True, kind="stable")
        .drop_duplicates(EVENT_ID, keep="first")
        .reset_index(drop=True)
    )


def build_decision_report(
    event: pd.Series | dict[str, Any],
    provenance: dict[str, Any],
    *,
    reviewer: str = "",
    review_outcome: str = "Pending human review",
    reviewer_notes: str = "",
) -> dict[str, Any]:
    """Build a reproducible decision record; never issue a maneuver command."""
    row = dict(event)
    risk = _safe_float(row.get("predicted_risk_log10_pc"))
    baseline_risk = _safe_float(row.get("baseline_risk_log10_pc"))
    distance = _safe_float(row.get("miss_distance"))
    rule_tier = classify_risk(baseline_risk, distance)
    event_id = str(row.get("event_id", ""))
    report_timestamp = datetime.now(timezone.utc)
    report_id_event = re.sub(r"[^A-Za-z0-9._-]+", "-", event_id).strip("-") or "unknown"
    feature_snapshot = {
        column: (
            _safe_float(row.get(column))
            if column != "c_object_type"
            else str(row.get(column, "UNKNOWN"))
        )
        for column in (
            "time_to_tca",
            "miss_distance",
            "relative_speed",
            "relative_position_r",
            "relative_position_t",
            "relative_position_n",
            "c_object_type",
            "c_sigma_r",
            "t_sigma_r",
            "max_risk_estimate",
            "F10",
            "AP",
        )
    }
    return {
        "report_id": f"CDM-{report_id_event}-{report_timestamp.strftime('%Y%m%dT%H%M%S.%fZ')}",
        "generated_at_utc": report_timestamp.isoformat(),
        "model_version": provenance.get("model_version", "unknown"),
        "event_id": event_id,
        "split": "test; final event outcome unavailable",
        "time_to_tca_days": _safe_float(row.get("time_to_tca")),
        "predicted_final_risk_log10_pc": risk,
        "predicted_pc": float(10**risk) if risk is not None else None,
        "classifier_tier": str(row.get("ml_predicted_tier", "")),
        "reported_tier": str(row.get("predicted_tier", "")),
        "classifier_score_uncalibrated": _safe_float(row.get("classifier_score")),
        "classifier_probabilities_uncalibrated": {
            tier: _safe_float(row.get(f"probability_{tier}")) for tier in TIERS
        },
        "max_risk_estimate_baseline_log10_pc": baseline_risk,
        "deterministic_baseline_tier": rule_tier,
        "observed_miss_distance_m": distance,
        "manual_review_required": bool(row.get("manual_review_required", True)),
        "manual_review_reasons": str(row.get("manual_review_reasons", "")),
        "reviewer": reviewer.strip(),
        "review_outcome": review_outcome,
        "reviewer_notes": reviewer_notes.strip(),
        "traceability": {
            "data_provenance": provenance,
            "predictor_fields": [
                "time_to_tca",
                "miss_distance",
                "relative_speed",
                "relative_position_r",
                "relative_position_t",
                "relative_position_n",
                "c_object_type",
                "c_sigma_r",
                "t_sigma_r",
                "max_risk_estimate",
                "F10",
                "AP",
            ],
            "group_key_excluded_from_model": "event_id",
            "selected_cdm_feature_snapshot": feature_snapshot,
            "rule_reference": "Autonomous SG 2026 Airbus Problem Statements (Updated), Challenge 1 clarifications, 31 Oct 2026",
            "rule_tier": rule_tier,
        },
        "operational_disclaimer": (
            "Decision support only. No maneuver is recommended or authorized. "
            "A qualified flight-dynamics operator must review the source CDMs, "
            "mission-approved covariance, and applicable operational policy."
        ),
    }


def _safe_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) else None


def report_as_markdown(report: dict[str, Any]) -> str:
    probabilities = report["classifier_probabilities_uncalibrated"]
    trace = report["traceability"]
    predicted_risk = report["predicted_final_risk_log10_pc"]
    predicted_pc = report["predicted_pc"]
    risk_text = f"{predicted_risk:.3f}" if predicted_risk is not None else "Unavailable"
    pc_text = f"{predicted_pc:.3e}" if predicted_pc is not None else "Unavailable"
    return f"""# Conjunction decision-support report

- **Report:** `{report['report_id']}`
- **Generated:** {report['generated_at_utc']}
- **Event:** `{report['event_id']}` · **TCA:** {report['time_to_tca_days']} days
- **Model:** `{report['model_version']}` · **Split:** {report['split']}
- **Predicted final tier:** **{report['reported_tier'].upper()}**
- **Predicted final log10(Pc):** {risk_text}
- **Predicted Pc:** {pc_text}
- **Classifier score (uncalibrated):** {report['classifier_score_uncalibrated']}
- **Tier scores (uncalibrated):** safe {probabilities['safe']}, elevated {probabilities['elevated']}, critical {probabilities['critical']}
- **Rule baseline:** {report['deterministic_baseline_tier']} from max_risk_estimate and observed miss distance
- **Observed miss distance:** {report['observed_miss_distance_m']} m
- **Manual review required:** {report['manual_review_required']} — {report['manual_review_reasons'] or 'no automatic review flag'}
- **Reviewer:** {report['reviewer'] or 'Not assigned'} · **Outcome:** {report['review_outcome']}
- **Reviewer notes:** {report['reviewer_notes'] or 'None'}

## Traceability

- **Rule source:** {trace['rule_reference']}
- **Data file hashes:** {trace['data_provenance']}
- **Model inputs:** {', '.join(trace['predictor_fields'])}
- **Excluded identifier:** {trace['group_key_excluded_from_model']} (used only to group events and prevent leakage)

## Human decision

{report['operational_disclaimer']}
"""
