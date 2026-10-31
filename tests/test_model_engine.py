import unittest
from unittest.mock import patch

import pandas as pd

from data_loader import EVENT_ID, MODEL_FEATURES
from model_engine import fit_models, predict_events


class ModelEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.events = []
        for tier_index, tier in enumerate(("safe", "elevated", "critical")):
            for event_index in range(12):
                row = {feature: float(event_index + tier_index) for feature in MODEL_FEATURES}
                row.update(
                    {
                        EVENT_ID: f"{tier}-{event_index}",
                        "c_object_type": "DEBRIS",
                        "risk": (-8.0, -5.0, -3.0)[tier_index],
                        "tier": tier,
                        "miss_distance": (8_000.0, 3_000.0, 500.0)[tier_index],
                        "time_to_tca": 2.5,
                        "max_risk_estimate": (-8.0, -5.0, -3.0)[tier_index],
                    }
                )
                self.events.append(row)
        self.training = pd.DataFrame(self.events)

    def test_prediction_includes_regression_classifier_and_audit_fields(self) -> None:
        models = fit_models(self.training, seed=42)
        predictions = predict_events(models, self.training.iloc[[0, 12, 24]])
        required = {
            "predicted_risk_log10_pc",
            "baseline_risk_log10_pc",
            "ml_predicted_tier",
            "predicted_tier",
            "classifier_score",
            "fallback_used",
            "manual_review_required",
            "manual_review_reasons",
        }
        self.assertTrue(required.issubset(predictions.columns))
        self.assertEqual(len(predictions), 3)
        self.assertTrue(predictions["predicted_tier"].isin(("safe", "elevated", "critical")).all())
        self.assertTrue(predictions["manual_review_required"].any())

    def test_missing_risk_baseline_forces_deterministic_review_fallback(self) -> None:
        models = fit_models(self.training, seed=42)
        event = self.training.head(1).copy()
        event["max_risk_estimate"] = float("nan")
        event["miss_distance"] = float("nan")
        prediction = predict_events(models, event).iloc[0]
        self.assertTrue(prediction["fallback_used"])
        self.assertTrue(prediction["manual_review_required"])
        self.assertEqual(prediction["predicted_tier"], "elevated")

    def test_low_classifier_confidence_uses_rule_tier(self) -> None:
        models = fit_models(self.training, seed=42)
        event = self.training.iloc[[0]].copy()
        with patch("model_engine.LOW_CONFIDENCE_THRESHOLD", 1.01):
            prediction = predict_events(models, event).iloc[0]
        self.assertTrue(prediction["fallback_used"])
        self.assertEqual(prediction["predicted_tier"], prediction["baseline_tier"])
        self.assertIn("confidence below", prediction["manual_review_reasons"])

    def test_predictions_repeat_with_same_model_seed(self) -> None:
        first = predict_events(fit_models(self.training, seed=42), self.training)
        second = predict_events(fit_models(self.training, seed=42), self.training)
        pd.testing.assert_series_equal(
            first["predicted_risk_log10_pc"],
            second["predicted_risk_log10_pc"],
            check_names=False,
            check_exact=False,
            rtol=1e-6,
        )


if __name__ == "__main__":
    unittest.main()
