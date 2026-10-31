export const riskThresholds = {
  safePc: 1e-6,
  criticalPc: 1e-4,
  criticalMissDistanceKm: 1,
  safeMissDistanceKm: 5,
};

export const riskTiers = {
  safe: "safe",
  elevated: "elevated",
  critical: "critical",
};

export function classifyCollisionRisk(pc, missDistanceKm) {
  if (!Number.isFinite(pc) || pc <= 0 || pc > 1) {
    throw new RangeError("Pc must be greater than 0 and no greater than 1.");
  }
  if (!Number.isFinite(missDistanceKm) || missDistanceKm < 0) {
    throw new RangeError("Miss distance must be a non-negative number of kilometers.");
  }

  if (
    pc >= riskThresholds.criticalPc ||
    missDistanceKm < riskThresholds.criticalMissDistanceKm
  ) {
    return riskTiers.critical;
  }
  if (
    pc >= riskThresholds.safePc ||
    missDistanceKm <= riskThresholds.safeMissDistanceKm
  ) {
    return riskTiers.elevated;
  }
  return riskTiers.safe;
}

export function classifyLog10Risk(log10Pc, missDistanceMeters) {
  if (!Number.isFinite(log10Pc) || !Number.isFinite(missDistanceMeters)) {
    throw new RangeError("Risk and miss distance must both be finite numbers.");
  }
  return classifyCollisionRisk(
    10 ** log10Pc,
    missDistanceMeters / 1000,
  );
}
