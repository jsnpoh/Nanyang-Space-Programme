import assert from "node:assert/strict";
import test from "node:test";
import { parseEventLabels } from "./summarize-event-model.mjs";

test("reads workbook event labels after note and blank preamble rows", () => {
  const labels = parseEventLabels(
    "One row per event. final_* describe closest approach,,,,,,,,\n" +
    ",,,,,,,,\n" +
    "event_id,mission_id,cdm_count,cdm_count_2d_or_more,final_time_to_tca_days,final_risk_log10_pc,final_miss_distance_m,final_tier,usable_for_training\n" +
    "4,5,5,3,0.5,-5.2,4000,Elevated,yes\n" +
    "5,5,2,0,0.2,-30,6000,Safe,no\n",
  );
  assert.equal(labels.size, 2);
  assert.deepEqual(labels.get("4"), {
    tier: "elevated",
    usable: true,
    finalTimeToTcaDays: 0.5,
    finalRiskLog10Pc: -5.2,
    finalMissDistanceMeters: 4000,
  });
  assert.equal(labels.get("5").usable, false);
});

test("rejects duplicated event-label records", () => {
  const csv =
    "event_id,final_tier,usable_for_training,final_time_to_tca_days,final_risk_log10_pc,final_miss_distance_m\n" +
    "4,Safe,yes,0.5,-8,8000\n" +
    "4,Critical,yes,0.2,-3,500\n";
  assert.throws(() => parseEventLabels(csv), /duplicate event_id 4/);
});
