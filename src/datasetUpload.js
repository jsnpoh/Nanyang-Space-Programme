function normalizeHeader(value) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s-]+/g, "_");
}

const TIER_RANK = { Critical: 3, Elevated: 2, Safe: 1 };

export function parseEventLabels(text) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().toLowerCase().startsWith("event_id,"));
  if (headerIndex < 0) throw new Error("Label file needs an event_id header.");
  const headers = lines[headerIndex].split(",").map((header) => normalizeHeader(header));
  const column = (name) => headers.indexOf(name);
  const idIndex = column("event_id");
  const tierIndex = column("final_tier");
  if (tierIndex < 0) throw new Error("Label file needs a final_tier column.");
  const number = (cells, name) => {
    const index = column(name);
    const value = index >= 0 && cells[index]?.trim() !== "" ? Number(cells[index]) : NaN;
    return Number.isFinite(value) ? value : null;
  };

  const labels = new Map();
  const tierCounts = { Critical: 0, Elevated: 0, Safe: 0 };
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = line.split(",");
    const eventId = cells[idIndex]?.trim();
    const tier = cells[tierIndex]?.trim();
    if (!eventId || !(tier in TIER_RANK)) continue;
    tierCounts[tier] += 1;
    labels.set(eventId, {
      tier,
      finalRiskLog10Pc: number(cells, "final_risk_log10_pc"),
      finalMissDistanceMeters: number(cells, "final_miss_distance_m"),
      finalTimeToTcaDays: number(cells, "final_time_to_tca_days"),
      messageCount: number(cells, "cdm_count"),
    });
  }
  return { labels, tierCounts };
}

export async function summarizeCsvStream(source, onProgress = () => {}, options = {}) {
  const labels = options.labels ?? null;
  if (!source || typeof source.stream !== "function" || !Number.isFinite(source.size) || source.size < 0) {
    throw new Error("Choose a valid CSV source.");
  }

  const reader = source.stream().getReader();
  const decoder = new TextDecoder();
  let field = "";
  let cells = [];
  let inQuotes = false;
  let pendingQuote = false;
  let skipLineFeed = false;
  let headers = null;
  let previewRows = [];
  let rows = 0;
  let invalidRows = 0;
  let riskIndex = -1;
  let eventIdIndex = -1;
  let missDistanceIndex = -1;
  let timeToTcaIndex = -1;
  let relativeTIndex = -1;
  let relativeNIndex = -1;
  let relativeRIndex = -1;
  let relativeSpeedIndex = -1;
  let orbitIndexes = {};
  let objectTypeIndex = -1;
  const encounterSummaries = new Map();
  let riskCount = 0;
  let riskMean = 0;
  let riskMin = Infinity;
  let riskMax = -Infinity;
  let bytesRead = 0;
  let lastProgressAt = 0;

  function readNumber(index) {
    return index >= 0 && cells[index].trim() !== "" ? Number(cells[index]) : NaN;
  }

  function finishRow() {
    cells.push(field);
    field = "";
    if (cells.every((cell) => cell.trim() === "")) {
      cells = [];
      return;
    }

    if (headers === null) {
      headers = cells.map((header) => header.trim().replace(/^\uFEFF/, ""));
      riskIndex = headers.findIndex((header) =>
        ["risk", "final_risk_log10_pc"].includes(normalizeHeader(header)),
      );
      eventIdIndex = headers.findIndex((header) => normalizeHeader(header) === "event_id");
      missDistanceIndex = headers.findIndex((header) =>
        ["miss_distance", "miss_distance_m", "final_miss_distance_m"].includes(normalizeHeader(header)),
      );
      timeToTcaIndex = headers.findIndex((header) => normalizeHeader(header) === "time_to_tca");
      relativeTIndex = headers.findIndex((header) => normalizeHeader(header) === "relative_position_t");
      relativeNIndex = headers.findIndex((header) => normalizeHeader(header) === "relative_position_n");
      relativeRIndex = headers.findIndex((header) => normalizeHeader(header) === "relative_position_r");
      relativeSpeedIndex = headers.findIndex((header) => normalizeHeader(header) === "relative_speed");
      objectTypeIndex = headers.findIndex((header) => normalizeHeader(header) === "c_object_type");
      orbitIndexes = Object.fromEntries(
        [
          ["targetSmaKm", "t_j2k_sma"], ["targetEcc", "t_j2k_ecc"], ["targetIncDeg", "t_j2k_inc"],
          ["chaserSmaKm", "c_j2k_sma"], ["chaserEcc", "c_j2k_ecc"], ["chaserIncDeg", "c_j2k_inc"],
        ].map(([key, name]) => [key, headers.findIndex((header) => normalizeHeader(header) === name)]),
      );
    } else if (cells.length !== headers.length) {
      invalidRows += 1;
    } else {
      rows += 1;
      if (previewRows.length < 6) previewRows.push(cells);
      if (riskIndex >= 0) {
        const risk = readNumber(riskIndex);
        if (Number.isFinite(risk)) {
          riskCount += 1;
          riskMean += (risk - riskMean) / riskCount;
          riskMin = Math.min(riskMin, risk);
          riskMax = Math.max(riskMax, risk);

          if (missDistanceIndex >= 0 && relativeTIndex >= 0 && relativeNIndex >= 0) {
            const eventId = eventIdIndex >= 0 && cells[eventIdIndex].trim()
              ? cells[eventIdIndex].trim()
              : `row-${rows}`;
            let encounter = encounterSummaries.get(eventId);
            if (!encounter) {
              encounter = {
                eventId,
                peakRiskLog10Pc: -Infinity,
                minMissDistanceMeters: Infinity,
                closestTimeToTcaDays: null,
                relativeSpeedMetersPerSecond: null,
                closestRelativeT: null,
                closestRelativeN: null,
                closestRelativeR: null,
                orbit: null,
                chaserObjectType: null,
                trajectory: [],
              };
              encounterSummaries.set(eventId, encounter);
            }

            const missDistance = readNumber(missDistanceIndex);
            const timeToTca = readNumber(timeToTcaIndex);
            const relativeT = readNumber(relativeTIndex);
            const relativeN = readNumber(relativeNIndex);
            const relativeR = readNumber(relativeRIndex);
            if (risk > encounter.peakRiskLog10Pc) encounter.peakRiskLog10Pc = risk;
            if (Number.isFinite(missDistance) && missDistance < encounter.minMissDistanceMeters) {
              encounter.minMissDistanceMeters = missDistance;
              encounter.closestTimeToTcaDays = Number.isFinite(timeToTca) ? timeToTca : null;
              encounter.closestRelativeT = Number.isFinite(relativeT) ? relativeT : null;
              encounter.closestRelativeN = Number.isFinite(relativeN) ? relativeN : null;
              encounter.closestRelativeR = Number.isFinite(relativeR) ? relativeR : null;
              if (relativeSpeedIndex >= 0) {
                const speed = readNumber(relativeSpeedIndex);
                encounter.relativeSpeedMetersPerSecond = Number.isFinite(speed) ? speed : null;
              }
              encounter.orbit = Object.fromEntries(
                Object.entries(orbitIndexes).map(([key, index]) => {
                  const value = readNumber(index);
                  return [key, Number.isFinite(value) ? value : null];
                }),
              );
              encounter.chaserObjectType = objectTypeIndex >= 0 ? cells[objectTypeIndex].trim() || null : null;
            }
            if (
              encounter.trajectory.length < 48 &&
              Number.isFinite(relativeT) &&
              Number.isFinite(relativeN)
            ) {
              encounter.trajectory.push({
                relativeT,
                relativeN,
                relativeR: Number.isFinite(relativeR) ? relativeR : 0,
                timeToTcaDays: Number.isFinite(timeToTca) ? timeToTca : null,
                missDistanceMeters: Number.isFinite(missDistance) ? missDistance : null,
              });
            }
          }
        }
      }
    }
    cells = [];
  }

  function processCharacter(character) {
    if (pendingQuote) {
      pendingQuote = false;
      if (character === '"') {
        field += '"';
        return;
      }
      inQuotes = false;
    }

    if (skipLineFeed) {
      skipLineFeed = false;
      if (character === "\n") return;
    }

    if (inQuotes) {
      if (character === '"') pendingQuote = true;
      else field += character;
      return;
    }

    if (character === '"' && field === "") {
      inQuotes = true;
    } else if (character === ",") {
      cells.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      finishRow();
      skipLineFeed = character === "\r";
    } else {
      field += character;
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      const text = decoder.decode(value, { stream: true });
      for (let index = 0; index < text.length; index += 1) {
        processCharacter(text[index]);
      }
      const now = Date.now();
      if (now - lastProgressAt >= 100) {
        onProgress(source.size > 0 ? Math.min(bytesRead / source.size, 1) : 0);
        lastProgressAt = now;
      }
    }

    const remaining = decoder.decode();
    for (let index = 0; index < remaining.length; index += 1) {
      processCharacter(remaining[index]);
    }
    if (pendingQuote) {
      pendingQuote = false;
      inQuotes = false;
    }
    if (inQuotes) throw new Error("CSV has an unclosed quoted field.");
    if (field !== "" || cells.length > 0) finishRow();
    if (!headers || rows === 0) {
      throw new Error("CSV must include a header and at least one valid data row.");
    }

    const encounters = [...encounterSummaries.values()];
    const toEncounterSummary = (encounter) => ({
      ...encounter,
      label: labels?.get(encounter.eventId) ?? null,
      peakCollisionProbability: 10 ** encounter.peakRiskLog10Pc,
      minMissDistanceMeters: Number.isFinite(encounter.minMissDistanceMeters)
        ? encounter.minMissDistanceMeters
        : null,
      trajectory: encounter.trajectory.sort(
        (left, right) => (right.timeToTcaDays ?? 0) - (left.timeToTcaDays ?? 0),
      ),
    });
    const closestEncounter = encounters
      .filter((encounter) => Number.isFinite(encounter.minMissDistanceMeters))
      .sort((left, right) => left.minMissDistanceMeters - right.minMissDistanceMeters)[0];

    onProgress(1);
    return {
      fileName: source.name,
      size: source.size,
      rows,
      columns: headers.length,
      headers,
      previewRows,
      invalidRows,
      encounterCount: encounters.length,
      closestEncounter: closestEncounter ? toEncounterSummary(closestEncounter) : null,
      peakEncounter: encounters.length
        ? toEncounterSummary(encounters.reduce((best, item) => (item.peakRiskLog10Pc > best.peakRiskLog10Pc ? item : best)))
        : null,
      ranking: labels ? "official-tier" : "peak-risk",
      topEncounters: encounters
        .filter((encounter) => Number.isFinite(encounter.peakRiskLog10Pc))
        .sort((left, right) => {
          const a = labels?.get(left.eventId);
          const b = labels?.get(right.eventId);
          if (a || b) {
            const tierDiff = (TIER_RANK[b?.tier] ?? 0) - (TIER_RANK[a?.tier] ?? 0);
            if (tierDiff) return tierDiff;
            const riskDiff = (b?.finalRiskLog10Pc ?? -Infinity) - (a?.finalRiskLog10Pc ?? -Infinity);
            if (riskDiff) return riskDiff;
            const missDiff = (a?.finalMissDistanceMeters ?? Infinity) - (b?.finalMissDistanceMeters ?? Infinity);
            if (missDiff) return missDiff;
          }
          return right.peakRiskLog10Pc - left.peakRiskLog10Pc;
        })
        .slice(0, 25)
        .map(toEncounterSummary),
      tierCounts: options.tierCounts ?? null,
      risk: riskCount
        ? { count: riskCount, min: riskMin, mean: riskMean, max: riskMax }
        : null,
    };
  } finally {
    reader.releaseLock();
  }
}

export async function summarizeCsvFile(file, onProgress = () => {}, options = {}) {
  if (!file || file.size === 0) {
    throw new Error("Choose a non-empty CSV file.");
  }
  return summarizeCsvStream(file, onProgress, options);
}
