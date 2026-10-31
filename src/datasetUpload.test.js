import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCsvFile, summarizeCsvStream } from "./datasetUpload.js";

function csvFile(chunks, name = "data.csv") {
  const encoder = new TextEncoder();
  const encoded = chunks.map((chunk) => encoder.encode(chunk));
  const size = encoded.reduce((total, chunk) => total + chunk.byteLength, 0);
  return {
    name,
    size,
    stream: () => new ReadableStream({
      start(controller) {
        encoded.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  };
}

test("summarizes quoted CSV fields split across chunks and tracks risk values", async () => {
  const progress = [];
  const result = await summarizeCsvFile(csvFile([
    "name,ri",
    "sk\r\n\"object, with ",
    "\"\"quotes\"\"\nand newline\",-4\r\nbad,2,extra\r\nspacecraft,-2\r\n",
  ]), (value) => progress.push(value));

  assert.equal(result.fileName, "data.csv");
  assert.equal(result.rows, 2);
  assert.equal(result.columns, 2);
  assert.equal(result.invalidRows, 1);
  assert.deepEqual(result.previewRows, [
    ['object, with "quotes"\nand newline', "-4"],
    ["spacecraft", "-2"],
  ]);
  assert.deepEqual(result.risk, { count: 2, min: -4, mean: -3, max: -2 });
  assert.equal(progress.at(-1), 1);
});

test("accepts final rows without a trailing newline and recognizes normalized risk headers", async () => {
  const result = await summarizeCsvFile(csvFile([
    "event id,final-risk-log10-pc\r\n",
    "evt-1,-6",
  ]));

  assert.equal(result.rows, 1);
  assert.equal(result.risk?.min, -6);
});

test("summarizes a streamed CSV when its content length is unknown", async () => {
  const file = csvFile(["id,value\n1,one"]);
  const result = await summarizeCsvStream({
    name: file.name,
    size: 0,
    stream: file.stream,
  });

  assert.equal(result.rows, 1);
  assert.equal(result.columns, 2);
  assert.equal(result.size, 0);
});

test("groups observations into encounters with peak Pc, closest miss, and relative trajectory", async () => {
  const result = await summarizeCsvFile(csvFile([
    "event_id,time_to_tca,risk,miss_distance,relative_position_t,relative_position_n,relative_speed\n",
    "A,2,-4,120,100,40,7500\n",
    "B,1,-2,80,30,20,8000\n",
    "A,1,-3,45,20,10,7500\n",
    "B,0.5,-1,50,10,5,8000\n",
    "C,0,-10,,,,\n",
  ]));

  assert.equal(result.encounterCount, 3);
  assert.deepEqual(result.topEncounters.map(({ eventId }) => eventId), ["B", "A", "C"]);
  assert.equal(result.topEncounters[0].peakCollisionProbability, 0.1);
  assert.equal(result.topEncounters[0].minMissDistanceMeters, 50);
  assert.equal(result.topEncounters[0].closestTimeToTcaDays, 0.5);
  assert.equal(result.topEncounters[0].relativeSpeedMetersPerSecond, 8000);
  assert.equal(result.closestEncounter.eventId, "A");
  assert.equal(result.closestEncounter.minMissDistanceMeters, 45);
  assert.deepEqual(result.topEncounters[1].trajectory.map(({ relativeT, relativeN }) => [relativeT, relativeN]), [
    [100, 40],
    [20, 10],
  ]);
});

test("rejects empty files, header-only files, and unclosed quoted fields", async () => {
  await assert.rejects(() => summarizeCsvFile(csvFile([""], "empty.csv")), /non-empty CSV/);
  await assert.rejects(() => summarizeCsvFile(csvFile(["name,risk\r\n"])), /at least one valid data row/);
  await assert.rejects(() => summarizeCsvFile(csvFile(["name,risk\n\"unfinished,-2"])), /unclosed quoted field/);
});

test("captures orbital elements and object type at the closest approach", async () => {
  const result = await summarizeCsvFile(csvFile([
    "event_id,risk,miss_distance,time_to_tca,relative_position_t,relative_position_n,t_j2k_sma,t_j2k_ecc,t_j2k_inc,c_j2k_sma,c_j2k_ecc,c_j2k_inc,c_object_type\n",
    "1,-5,900,3,1,2,7000,0.001,98,7100,0.02,81,DEBRIS\n",
    "1,-4,300,2,1,2,7001,0.002,98.5,7101,0.03,82,DEBRIS\n",
  ]));
  const [encounter] = result.topEncounters;
  assert.equal(encounter.chaserObjectType, "DEBRIS");
  assert.deepEqual(encounter.orbit, {
    targetSmaKm: 7001, targetEcc: 0.002, targetIncDeg: 98.5,
    chaserSmaKm: 7101, chaserEcc: 0.03, chaserIncDeg: 82,
  });
});

test("parses organiser labels and ranks encounters by official tier", async () => {
  const { parseEventLabels } = await import("./datasetUpload.js");
  const parsed = parseEventLabels([
    "Note line,,,",
    ",,,",
    "event_id,mission_id,cdm_count,cdm_count_2d_or_more,final_time_to_tca_days,final_risk_log10_pc,final_miss_distance_m,final_tier,usable_for_training",
    "1,5,3,2,0.2,-9,500,Safe,yes",
    "2,5,3,2,0.1,-30,300,Critical,yes",
  ].join("\n"));
  assert.deepEqual(parsed.tierCounts, { Critical: 1, Elevated: 0, Safe: 1 });

  const result = await summarizeCsvFile(csvFile([
    "event_id,risk,miss_distance,time_to_tca,relative_position_t,relative_position_n\n",
    "1,-2,900,3,1,2\n",
    "2,-20,300,3,1,2\n",
  ]), () => {}, parsed);
  assert.equal(result.ranking, "official-tier");
  assert.deepEqual(result.topEncounters.map((e) => [e.eventId, e.label.tier]), [["2", "Critical"], ["1", "Safe"]]);
});
