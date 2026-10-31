import unittest

from risk_policy import classify_risk


class RiskPolicyTests(unittest.TestCase):
    def test_exact_probability_and_distance_boundaries(self) -> None:
        self.assertEqual(classify_risk(-6, 5_000), "elevated")
        self.assertEqual(classify_risk(-6.0001, 5_000.01), "safe")
        self.assertEqual(classify_risk(-4, 8_000), "critical")
        self.assertEqual(classify_risk(-8, 999.999), "critical")
        self.assertEqual(classify_risk(-8, 1_000), "elevated")

    def test_most_severe_independent_trigger_wins(self) -> None:
        self.assertEqual(classify_risk(-5, 500), "critical")
        self.assertEqual(classify_risk(-3, 10_000), "critical")
        self.assertEqual(classify_risk(-7, 2_500), "elevated")

    def test_missing_evidence_never_falls_through_to_safe(self) -> None:
        self.assertEqual(classify_risk(None, 10_000), "elevated")
        self.assertEqual(classify_risk(-8, None), "elevated")
        self.assertEqual(classify_risk(float("nan"), 10_000), "elevated")
        self.assertEqual(classify_risk(-8, float("nan")), "elevated")


if __name__ == "__main__":
    unittest.main()
