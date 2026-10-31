import assert from "node:assert/strict";
import test from "node:test";
import { createScreenedCsv, screenCsvContent } from "./csvScreening.js";

test("screens Pc and meter-distance columns and keeps source row values", () => {
  const result = screenCsvContent(
    "event_id,pc,miss_distance_m,time_to_tca\n" +
    "CDM-1,1e-4,8000,0.5\n" +
    "CDM-2,1e-7,9000,2\n",
  );

  assert.equal(result.screenedRows.length, 2);
  assert.equal(result.screenedRows[0].classification, "critical");
  assert.equal(result.screenedRows[0].missDistanceKm, 8);
  assert.equal(result.screenedRows[1].classification, "safe");
  assert.equal(result.screenedRows[0].eventId, "CDM-1");
});

test("converts dataset risk log10(Pc) and meter-based miss distance", () => {
  const result = screenCsvContent("event_id,risk,miss_distance\nCDM-3,-8,999\n");
  assert.equal(result.screenedRows[0].pc, 1e-8);
  assert.equal(result.screenedRows[0].classification, "critical");
});

test("supports kilometer distance columns, quoted commas, and escaped quotes", () => {
  const result = screenCsvContent(
    'event_id,pc,miss_distance_km,note\n"CDM, ""A""",1e-7,8,"quoted, note"\n',
  );
  assert.equal(result.screenedRows[0].eventId, 'CDM, "A"');
  assert.equal(result.screenedRows[0].classification, "safe");
});

test("reports invalid data rows without dropping valid screened rows", () => {
  const result = screenCsvContent(
    "event_id,pc,miss_distance_km\nCDM-1,1e-7,8\nCDM-2,2,1\nCDM-3,,5\n",
  );
  assert.equal(result.screenedRows.length, 1);
  assert.equal(result.rejectedRows.length, 2);
  assert.equal(result.rejectedRows[0].rowNumber, 3);
  assert.match(result.rejectedRows[0].reason, /Pc must be greater than 0/);
});

test("requires collision probability and miss-distance columns", () => {
  assert.throws(
    () => screenCsvContent("event_id,miss_distance\nCDM-1,1000\n"),
    /needs a 'pc' probability column or a 'risk' log10\(Pc\) column/,
  );
  assert.throws(
    () => screenCsvContent("event_id,pc\nCDM-1,1e-7\n"),
    /needs 'miss_distance_m'/,
  );
});

test("rejects malformed, empty, and duplicate-header CSV input", () => {
  assert.throws(() => screenCsvContent(""), /file is empty/);
  assert.throws(() => screenCsvContent('event_id,pc\n"CDM-1,1e-7'), /unclosed quoted field/);
  assert.throws(
    () => screenCsvContent("pc,PC,miss_distance\n1e-7,1e-7,8000\n"),
    /duplicate column names/,
  );
});

test("exports source data with screening output and protects spreadsheet formulas", () => {
  const result = screenCsvContent(
    'event_id,pc,miss_distance_km\n"=HYPERLINK(""https://example.com"")",1e-7,8\n',
  );
  const output = createScreenedCsv(result.headers, result.screenedRows);
  assert.match(output, /screening_result/);
  assert.match(output, /"'=HYPERLINK/);
  assert.match(output, /safe/);
});
