import assert from "node:assert/strict";
import test from "node:test";
import { classifyCollisionRisk, classifyLog10Risk } from "./riskPolicy.js";
import { riskTestCases } from "./riskTestCases.js";

for (const scenario of riskTestCases) {
  test(`${scenario.id}: ${scenario.name}`, () => {
    assert.equal(
      classifyCollisionRisk(scenario.pc, scenario.missDistanceKm),
      scenario.expected,
    );
  });
}

test("classifies dataset log10(Pc) using miss distance in meters", () => {
  assert.equal(classifyLog10Risk(-5, 8000), "elevated");
  assert.equal(classifyLog10Risk(-8, 999), "critical");
  assert.equal(classifyLog10Risk(-8, 6000), "safe");
});

test("rejects impossible collision probabilities", () => {
  assert.throws(() => classifyCollisionRisk(0, 6), RangeError);
  assert.throws(() => classifyCollisionRisk(1.1, 6), RangeError);
  assert.throws(() => classifyCollisionRisk(NaN, 6), RangeError);
  assert.throws(() => classifyCollisionRisk(1e-5, -1), RangeError);
});
