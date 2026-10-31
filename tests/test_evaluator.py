import unittest

import pandas as pd

from evaluator import (
    build_decision_report,
    evaluate_holdout,
    screen_current_cdms,
    warning_events,
)


class EvaluatorTests(unittest.TestCase):
    def _events(self) -> pd.DataFrame:
        rows = []
        for tier_index, tier in enumerate(("safe", "elevated", "critical")):
            for event_index in range(10):
                rows.append(
                    {
                        "event_id": f"{tier}-{event_index}",
                        "time_to_tca": 2.5,
                        "miss_distance": (9_000, 3_000, 500)[tier_index],
                        "final_miss_distance_m": (9_000, 3_000, 500)[tier_index],
                        "relative_speed": 10_000 + event_index,
                        "relative_position_r": 1.0 + event_index,
                        "relative_position_t": 2.0,
                        "relative_position_n": 3.0,
                        "c_sigma_r": 50.0,
                        "t_sigma_r": 30.0,
                        "max_risk_estimate": (-8, -5, -3)[tier_index],
                        "F10": 100.0,
                        "AP": 10.0,
                        "c_object_type": "DEBRIS",
                        "risk": (-8, -5, -3)[tier_index],
                        "tier": tier,
                    }
                )
        return pd.DataFrame(rows)

    def test_validation_is_grouped_and_reports_each_baseline(self) -> None:
        result = evaluate_holdout(self._events(), seed=42)
        self.assertFalse(result["regression"]["model"]["mae"] < 0)
        self.assertIn("baseline_max_risk_estimate", result["regression"])
        self.assertIn("baseline_max_risk_estimate", result["classification"])
        self.assertEqual(sum(sum(row) for row in result["classification"]["model"]["confusion_matrix"]), result["validation_events"])
        self.assertEqual(result["train_event_ids"], result["train_events"])
        self.assertEqual(result["validation_event_ids"], result["validation_events"])

    def test_warning_queue_requires_nonnegative_tca_within_24h(self) -> None:
        events = pd.DataFrame(
            [
                {"event_id": "soon", "time_to_tca": 0.5, "predicted_tier": "critical"},
                {"event_id": "past", "time_to_tca": -0.1, "predicted_tier": "critical"},
                {"event_id": "later", "time_to_tca": 1.5, "predicted_tier": "critical"},
                {"event_id": "safe", "time_to_tca": 0.5, "predicted_tier": "safe"},
            ]
        )
        self.assertEqual(warning_events(events)["event_id"].tolist(), ["soon"])

    def test_live_snapshot_screens_only_upcoming_cdms_and_deduplicates(self) -> None:
        events = pd.DataFrame(
            [
                {"event_id": "soon", "time_to_tca": 0.8, "risk": -8, "miss_distance": 8_000, "relative_speed": 5_000},
                {"event_id": "soon", "time_to_tca": 0.2, "risk": -8, "miss_distance": 750, "relative_speed": 5_000},
                {"event_id": "later", "time_to_tca": 1.5, "risk": -2, "miss_distance": 9_000, "relative_speed": 5_000},
            ]
        )
        screened = screen_current_cdms(events)
        self.assertEqual(screened["event_id"].tolist(), ["soon"])
        self.assertEqual(screened.iloc[0]["screened_tier"], "critical")
        self.assertTrue(screened.iloc[0]["manual_review_required"])

    def test_decision_report_contains_source_and_human_review_record(self) -> None:
        report = build_decision_report(
            {
                "event_id": "7",
                "time_to_tca": 2.5,
                "predicted_risk_log10_pc": -6.5,
                "ml_predicted_tier": "safe",
                "predicted_tier": "elevated",
                "classifier_score": 0.57,
                "probability_safe": 0.57,
                "probability_elevated": 0.31,
                "probability_critical": 0.12,
                "baseline_risk_log10_pc": -8,
                "miss_distance": 4_000,
                "manual_review_required": True,
                "manual_review_reasons": "model disagreement",
            },
            {"model_version": "test-version", "train_sha256": "abc"},
            reviewer="Flight dynamics",
        )
        self.assertEqual(report["event_id"], "7")
        self.assertEqual(report["reviewer"], "Flight dynamics")
        self.assertIn("train_sha256", report["traceability"]["data_provenance"])
        self.assertIn("No maneuver", report["operational_disclaimer"])


if __name__ == "__main__":
    unittest.main()
