"""Deterministic conjunction-risk thresholds from the Challenge 1 brief."""

from __future__ import annotations

import math
from typing import Optional

SAFE_RISK_LOG10 = -6.0
CRITICAL_RISK_LOG10 = -4.0
CRITICAL_MISS_DISTANCE_M = 1_000.0
SAFE_MISS_DISTANCE_M = 5_000.0
TIERS = ("safe", "elevated", "critical")


def _finite(value: object) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def classify_risk(
    risk_log10_pc: object, miss_distance_m: object
) -> str:
    """Apply the brief's conservative rules; unknown evidence never becomes Safe."""
    risk = _finite(risk_log10_pc)
    distance = _finite(miss_distance_m)

    if (
        (risk is not None and risk >= CRITICAL_RISK_LOG10)
        or (distance is not None and distance < CRITICAL_MISS_DISTANCE_M)
    ):
        return "critical"
    if (
        (risk is not None and risk >= SAFE_RISK_LOG10)
        or (distance is not None and distance <= SAFE_MISS_DISTANCE_M)
    ):
        return "elevated"
    if risk is None or distance is None:
        return "elevated"
    return "safe"


def tier_from_code(code: int) -> str:
    return TIERS[int(code)]
