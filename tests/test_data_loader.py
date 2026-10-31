import unittest
from io import BytesIO

import pandas as pd

from data_loader import (
    EVENT_ID,
    MODEL_FEATURES,
    load_cdm_data,
    load_event_labels,
    prepare_test_events,
    prepare_training_events,
)


def _cdm_row(event_id: str, time_to_tca: float, risk: float = -9.0) -> dict:
    row = {column: 1.0 for column in MODEL_FEATURES}
    row.update(
        {
            EVENT_ID: event_id,
            "time_to_tca": time_to_tca,
            "miss_distance": 10_000.0,
            "risk": risk,
            "max_risk_estimate": -8.0,
            "c_object_type": "DEBRIS",
        }
    )
    return row


class DataLoaderTests(unittest.TestCase):
    def test_cdm_loader_drops_non_allowlisted_fields(self) -> None:
        data = pd.DataFrame(
            [
                {
                    **_cdm_row("1", 2.5),
                    "mission_id": "not allowed",
                    "sensitive_extra": "not allowed",
                }
            ]
        ).to_csv(index=False).encode()
        frame = load_cdm_data(BytesIO(data))
        self.assertIn(EVENT_ID, frame)
        self.assertIn("risk", frame)
        self.assertNotIn("mission_id", frame)
        self.assertNotIn("sensitive_extra", frame)
        self.assertTrue(set(frame.columns).issubset({EVENT_ID, *MODEL_FEATURES, "risk"}))

    def test_duplicate_headers_are_explicitly_rejected(self) -> None:
        header = ",".join([EVENT_ID, *MODEL_FEATURES, "risk", "risk"])
        with self.assertRaisesRegex(ValueError, "duplicate column"):
            load_cdm_data(BytesIO((header + "\n").encode()))

    def test_workbook_preamble_and_final_outcome_join(self) -> None:
        header = ",".join(
            [
                EVENT_ID,
                "mission_id",
                "final_risk_log10_pc",
                "final_miss_distance_m",
                "final_tier",
                "usable_for_training",
            ]
        )
        labels = (
            "notes about the workbook,,,,,\n\n"
            + header
            + "\nE1,1,-7,7000,safe,yes\nE2,1,-30,18000,safe,yes\n"
        )
        frame = load_event_labels(BytesIO(labels.encode()))
        cdms = pd.DataFrame(
            [
                _cdm_row("E1", 2.1),
                _cdm_row("E1", 4.0),
                _cdm_row("E2", 3.2, -30),
                _cdm_row("E2", 1.0, -30),
            ]
        )
        training, stats = prepare_training_events(cdms, frame)
        self.assertEqual(len(training), 2)
        self.assertEqual(set(training[EVENT_ID]), {"E1", "E2"})
        self.assertEqual(training.loc[training[EVENT_ID].eq("E1"), "time_to_tca"].item(), 2.1)
        self.assertEqual(stats["events_with_2d_cdm"], 2)

    def test_workbook_label_mismatch_is_not_silently_accepted(self) -> None:
        labels = pd.DataFrame(
            [
                {
                    EVENT_ID: "E1",
                    "final_risk_log10_pc": -3.0,
                    "final_miss_distance_m": 8_000.0,
                    "final_tier": "safe",
                    "usable_for_training": True,
                }
            ]
        )
        with self.assertRaisesRegex(ValueError, "does not match"):
            prepare_training_events(pd.DataFrame([_cdm_row("E1", 2.5)]), labels)

    def test_test_event_ids_remain_in_their_own_namespace(self) -> None:
        train_labels = pd.DataFrame(
            [
                {
                    EVENT_ID: "0",
                    "final_risk_log10_pc": -7.0,
                    "final_miss_distance_m": 8_000.0,
                    "final_tier": "safe",
                    "usable_for_training": True,
                }
            ]
        )
        test_rows = pd.DataFrame([_cdm_row("0", 3.0, risk=-2.0)])
        prediction_rows, _ = prepare_test_events(test_rows)
        self.assertEqual(prediction_rows[EVENT_ID].tolist(), ["0"])
        self.assertNotIn("final_tier", prediction_rows)
        self.assertEqual(train_labels.loc[0, "final_tier"], "safe")


if __name__ == "__main__":
    unittest.main()
