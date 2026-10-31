import { classifyCollisionRisk } from "./riskPolicy.js";

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (inQuotes) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && content[index + 1] === "\n") index += 1;
    } else if (character === '"' && field === "") {
      inQuotes = true;
    } else if (character === '"') {
      throw new Error("CSV contains a quote in an unquoted field.");
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("CSV has an unclosed quoted field.");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function findHeaderRow(rows) {
  const probabilityHeaders = new Set(["pc", "risk", "final_risk_log10_pc"]);
  const distanceHeaders = new Set([
    "miss_distance",
    "miss_distance_m",
    "miss_distance_km",
    "final_miss_distance_m",
  ]);
  const probabilityHeaderRow = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => probabilityHeaders.has(header));
  });
  const completeHeaderRow = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => probabilityHeaders.has(header)) &&
      headers.some((header) => distanceHeaders.has(header));
  });
  return completeHeaderRow === -1 ? probabilityHeaderRow : completeHeaderRow;
}

function parseNumber(value, label) {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${label} is missing.`);
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function firstPresentCell(cells, indexes) {
  for (const index of indexes) {
    if (index !== undefined && cells[index]?.trim() !== "") return cells[index];
  }
  return undefined;
}

export function screenCsvContent(content) {
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("The selected CSV file is empty.");
  }

  const rows = parseCsvRows(content.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === -1) {
    throw new Error("CSV needs a 'pc' probability column or a 'risk' log10(Pc) column.");
  }
  const dataRows = rows.slice(headerRowIndex + 1);
  if (dataRows.length > 100_000) {
    throw new Error("CSV exceeds the 100,000-row screening limit. Split it into smaller CSV files.");
  }

  const headers = rows[headerRowIndex].map((header) => header.trim());
  const normalizedHeaders = headers.map(normalizeHeader);
  const uniqueHeaders = new Set(normalizedHeaders);
  if (uniqueHeaders.size !== normalizedHeaders.length) {
    throw new Error("CSV contains duplicate column names.");
  }

  const column = (name) => {
    const index = normalizedHeaders.indexOf(name);
    return index === -1 ? undefined : index;
  };
  const pcIndex = column("pc");
  const riskIndex = column("risk") ?? column("final_risk_log10_pc");
  const kmDistanceIndex = column("miss_distance_km");
  const meterDistanceIndex = column("miss_distance_m") ?? column("final_miss_distance_m");
  const defaultDistanceIndex = column("miss_distance");
  const distanceIndexes = [kmDistanceIndex, meterDistanceIndex, defaultDistanceIndex];

  if (pcIndex === undefined && riskIndex === undefined) {
    throw new Error("CSV needs a 'pc' probability column or a 'risk' log10(Pc) column.");
  }
  if (distanceIndexes.every((index) => index === undefined)) {
    throw new Error("CSV needs 'miss_distance_m' (meters), 'miss_distance_km', or 'miss_distance' (meters).");
  }

  const eventIdIndex = column("event_id");
  const timeToTcaIndex = column("time_to_tca");
  const screenedRows = [];
  const rejectedRows = [];

  dataRows.forEach((cells, rowIndex) => {
    const csvRowNumber = headerRowIndex + rowIndex + 2;
    if (cells.length !== headers.length) {
      rejectedRows.push({
        rowNumber: csvRowNumber,
        reason: `Expected ${headers.length} columns but found ${cells.length}.`,
      });
      return;
    }

    try {
      const pcValue = firstPresentCell(cells, [pcIndex]);
      const riskValue = firstPresentCell(cells, [riskIndex]);
      const pc = pcValue !== undefined
        ? parseNumber(pcValue, "Pc")
        : 10 ** parseNumber(riskValue, "risk (log10(Pc))");
      const distanceValue = firstPresentCell(cells, distanceIndexes);
      const distanceIndex = distanceIndexes.find((index) => index !== undefined && cells[index]?.trim() !== "");
      const rawDistance = parseNumber(distanceValue, "Miss distance");
      const missDistanceKm = distanceIndex === kmDistanceIndex
        ? rawDistance
        : rawDistance / 1000;
      const classification = classifyCollisionRisk(pc, missDistanceKm);
      const rawEventId = eventIdIndex === undefined ? "" : cells[eventIdIndex].trim();
      const rawTimeToTca = timeToTcaIndex === undefined ? "" : cells[timeToTcaIndex].trim();
      const timeToTcaDays = rawTimeToTca === "" ? null : parseNumber(rawTimeToTca, "time_to_tca");

      screenedRows.push({
        csvRowNumber,
        cells,
        eventId: rawEventId || `Row ${csvRowNumber}`,
        pc,
        missDistanceKm,
        timeToTcaDays,
        classification,
      });
    } catch (error) {
      rejectedRows.push({
        rowNumber: csvRowNumber,
        reason: error instanceof Error ? error.message : "Could not read this row.",
      });
    }
  });

  if (screenedRows.length === 0) {
    throw new Error(`No rows could be screened. Check the required columns and values (${rejectedRows.length} invalid rows).`);
  }

  return { headers, screenedRows, rejectedRows };
}

function protectSpreadsheetFormula(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+@]/.test(text) || (/^[\s]*-/.test(text) && Number.isNaN(Number(text.trim())))
    ? `'${text}`
    : text;
}

export function createScreenedCsv(headers, screenedRows) {
  const outputHeaders = [
    ...headers,
    "screening_result",
    "collision_probability_pc",
    "miss_distance_km",
  ];
  const outputRows = screenedRows.map((record) => [
    ...record.cells,
    record.classification,
    record.pc,
    record.missDistanceKm,
  ]);
  return [outputHeaders, ...outputRows]
    .map((row) => row.map((value) => {
      const text = protectSpreadsheetFormula(value);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(","))
    .join("\r\n");
}
