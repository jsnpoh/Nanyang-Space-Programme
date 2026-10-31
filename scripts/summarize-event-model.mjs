import { createReadStream, promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const TIERS = ["safe", "elevated", "critical"];
const TIER_INDEX = Object.fromEntries(TIERS.map((tier, index) => [tier, index]));
const OBJECT_TYPES = ["DEBRIS", "PAYLOAD", "ROCKET BODY", "TBA", "UNKNOWN"];
const NUMERIC_FEATURES = [
  "time_to_tca",
  "miss_distance",
  "relative_speed",
  "relative_position_r",
  "relative_position_t",
  "relative_position_n",
  "c_sigma_r",
  "t_sigma_r",
  "max_risk_estimate",
  "f10",
  "ap",
];
const LABEL_COLUMNS = [
  "event_id",
  "final_tier",
  "usable_for_training",
  "final_time_to_tca_days",
  "final_risk_log10_pc",
  "final_miss_distance_m",
];
const DEFAULT_OUTPUT = resolve("src/data/event-model-summary.json");

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  values.push(value);
  return values;
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseFiniteNumber(value) {
  if (value === undefined || value.trim() === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function transformFeature(field, value) {
  const number = parseFiniteNumber(value);
  if (!Number.isFinite(number)) return NaN;
  switch (field) {
    case "miss_distance":
    case "relative_speed":
    case "c_sigma_r":
    case "t_sigma_r":
      return Math.log1p(number / 1000);
    case "relative_position_r":
    case "relative_position_t":
    case "relative_position_n":
      return Math.sign(number) * Math.log1p(Math.abs(number) / 1000);
    default:
      return number;
  }
}

export function parseEventLabels(content) {
  const rows = content.replace(/^\uFEFF/, "").split(/\r?\n/).map(parseCsvLine);
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("event_id") &&
      headers.includes("final_tier") &&
      headers.includes("usable_for_training");
  });
  if (headerRowIndex < 0) {
    throw new Error("Event-label CSV must include event_id, final_tier, and usable_for_training columns.");
  }
  const headers = rows[headerRowIndex].map(normalizeHeader);
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) {
    throw new Error(`Event-label CSV has duplicate columns: ${[...new Set(duplicates)].join(", ")}.`);
  }
  const missing = LABEL_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) {
    throw new Error(`Event-label CSV is missing required columns: ${missing.join(", ")}.`);
  }
  const indices = Object.fromEntries(LABEL_COLUMNS.map((column) => [column, headers.indexOf(column)]));
  const labels = new Map();
  for (const [rowIndex, row] of rows.slice(headerRowIndex + 1).entries()) {
    if (row.every((value) => value.trim() === "")) continue;
    if (row.length !== headers.length) {
      throw new Error(`Event-label CSV row ${headerRowIndex + rowIndex + 2} has an unexpected number of columns.`);
    }
    const eventId = row[indices.event_id].trim();
    const tier = row[indices.final_tier].trim().toLowerCase();
    const usableValue = row[indices.usable_for_training].trim().toLowerCase();
    const finalValues = [
      row[indices.final_time_to_tca_days],
      row[indices.final_risk_log10_pc],
      row[indices.final_miss_distance_m],
    ].map(parseFiniteNumber);
    if (
      !eventId ||
      !TIERS.includes(tier) ||
      !["yes", "no"].includes(usableValue) ||
      finalValues.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(`Event-label CSV row ${headerRowIndex + rowIndex + 2} has invalid event, tier, eligibility, or final metric values.`);
    }
    if (labels.has(eventId)) throw new Error(`Event-label CSV contains duplicate event_id ${eventId}.`);
    labels.set(eventId, {
      tier,
      usable: usableValue === "yes",
      finalTimeToTcaDays: finalValues[0],
      finalRiskLog10Pc: finalValues[1],
      finalMissDistanceMeters: finalValues[2],
    });
  }
  return labels;
}

async function readEventObservations(filePath, datasetSplit, eligibleIds) {
  const events = new Map();
  let headers;
  let indices;
  let rows = 0;
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const rawLine of lines) {
      if (!headers) {
        headers = parseCsvLine(rawLine.replace(/^\uFEFF/, "")).map(normalizeHeader);
        const required = ["event_id", "time_to_tca", "c_object_type", ...NUMERIC_FEATURES];
        const missing = required.filter((column) => !headers.includes(column));
        if (missing.length) throw new Error(`${filePath} is missing columns: ${missing.join(", ")}.`);
        indices = Object.fromEntries(required.map((column) => [column, headers.indexOf(column)]));
        continue;
      }
      if (!rawLine) continue;
      rows += 1;
      const values = parseCsvLine(rawLine);
      if (values.length !== headers.length) {
        throw new Error(`${filePath}, row ${rows + 1}: found ${values.length} fields; expected ${headers.length}.`);
      }
      const eventId = values[indices.event_id].trim();
      const timeToTca = parseFiniteNumber(values[indices.time_to_tca]);
      if (!eventId || !Number.isFinite(timeToTca) || timeToTca < 2) continue;
      if (eligibleIds && !eligibleIds.has(eventId)) continue;

      const features = NUMERIC_FEATURES.map((field) => transformFeature(field, values[indices[field]]));
      const rawObjectType = values[indices.c_object_type].trim().toUpperCase();
      const objectType = OBJECT_TYPES.includes(rawObjectType) ? rawObjectType : "UNKNOWN";
      const previous = events.get(eventId);
      if (!previous || timeToTca < previous.timeToTca) {
        events.set(eventId, {
          eventId,
          timeToTca,
          features,
          objectType,
          missDistanceMeters: parseFiniteNumber(values[indices.miss_distance]),
        });
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }
  if (!headers || !rows) throw new Error(`${filePath} is empty or contains no observations.`);
  return { rows, events };
}

function hashEventId(eventId, tier) {
  let hash = 2166136261;
  for (const character of `${tier}:${eventId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function prepareFeatures(events, trainingIndexes) {
  const featureCount = NUMERIC_FEATURES.length + OBJECT_TYPES.length;
  const means = Array(NUMERIC_FEATURES.length).fill(0);
  const scales = Array(NUMERIC_FEATURES.length).fill(1);
  for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
    const values = trainingIndexes
      .map((index) => events[index].features[column])
      .filter(Number.isFinite);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const variance = values.length
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
      : 1;
    means[column] = mean;
    scales[column] = Math.sqrt(variance) || 1;
  }

  const matrix = events.map((event) => {
    const vector = Array(featureCount + 1).fill(0);
    vector[0] = 1;
    for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
      const value = event.features[column];
      vector[column + 1] = Number.isFinite(value) ? (value - means[column]) / scales[column] : 0;
    }
    const categoryIndex = OBJECT_TYPES.indexOf(event.objectType);
    vector[NUMERIC_FEATURES.length + 1 + categoryIndex] = 1;
    return vector;
  });
  return { matrix, means, scales, featureCount };
}

function softmax(logits) {
  const maximum = Math.max(...logits);
  const values = logits.map((value) => Math.exp(value - maximum));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

function trainClassifier(matrix, labels, indices, featureCount) {
  const weights = Array.from({ length: TIERS.length }, () => Array(featureCount).fill(0));
  const classCounts = TIERS.map((tier) =>
    indices.filter((index) => labels[index] === tier).length,
  );
  const classWeights = classCounts.map((count) =>
    count ? indices.length / (TIERS.length * count) : 0,
  );
  const totalSampleWeight = indices.reduce(
    (sum, index) => sum + classWeights[TIER_INDEX[labels[index]]],
    0,
  );
  const epochs = 160;
  const learningRate = 0.15;
  const regularization = 0.001;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = Array.from({ length: TIERS.length }, () => Array(featureCount).fill(0));
    for (const index of indices) {
      const vector = matrix[index];
      const probabilities = softmax(weights.map((row) =>
        row.reduce((sum, weight, column) => sum + weight * vector[column], 0),
      ));
      const actual = TIER_INDEX[labels[index]];
      const sampleWeight = classWeights[actual];
      for (let tier = 0; tier < TIERS.length; tier += 1) {
        const error = sampleWeight * (probabilities[tier] - (tier === actual ? 1 : 0));
        for (let column = 0; column < featureCount; column += 1) {
          gradients[tier][column] += error * vector[column];
        }
      }
    }
    for (let tier = 0; tier < TIERS.length; tier += 1) {
      for (let column = 0; column < featureCount; column += 1) {
        const penalty = column === 0 ? 0 : regularization * weights[tier][column];
        weights[tier][column] -= learningRate * (gradients[tier][column] / totalSampleWeight + penalty);
      }
    }
  }
  return weights;
}

function predict(weights, vector) {
  const probabilities = softmax(weights.map((row) =>
    row.reduce((sum, weight, column) => sum + weight * vector[column], 0),
  ));
  const tierIndex = probabilities.indexOf(Math.max(...probabilities));
  return {
    tier: TIERS[tierIndex],
    confidence: probabilities[tierIndex],
    probabilities: Object.fromEntries(TIERS.map((tier, index) => [tier, probabilities[index]])),
  };
}

function summarizeMetrics(records) {
  const confusion = Object.fromEntries(TIERS.map((tier) => [
    tier,
    Object.fromEntries(TIERS.map((predicted) => [predicted, 0])),
  ]));
  for (const record of records) confusion[record.actualTier][record.predictedTier] += 1;
  const classes = Object.fromEntries(TIERS.map((tier) => {
    const truePositive = confusion[tier][tier];
    const actual = Object.values(confusion[tier]).reduce((sum, value) => sum + value, 0);
    const predicted = TIERS.reduce((sum, actualTier) => sum + confusion[actualTier][tier], 0);
    const precision = predicted ? truePositive / predicted : 0;
    const recall = actual ? truePositive / actual : 0;
    return [tier, {
      actualEvents: actual,
      predictedEvents: predicted,
      precision,
      recall,
      f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    }];
  }));
  const correct = TIERS.reduce((sum, tier) => sum + confusion[tier][tier], 0);
  return {
    events: records.length,
    accuracy: records.length ? correct / records.length : 0,
    balancedAccuracy: TIERS.reduce((sum, tier) => sum + classes[tier].recall, 0) / TIERS.length,
    classMetrics: classes,
    confusionMatrix: confusion,
  };
}

export async function buildEventModelSummary(trainPath, labelsPath, testPath, outputPath = DEFAULT_OUTPUT) {
  const labelContent = await fs.readFile(resolve(labelsPath), "utf8");
  const labels = parseEventLabels(labelContent);
  const eligibleLabels = new Map([...labels].filter(([, label]) => label.usable));
  const trainData = await readEventObservations(
    resolve(trainPath),
    "train",
    new Set(eligibleLabels.keys()),
  );
  const trainingEvents = [...trainData.events.values()]
    .map((event) => ({ ...event, tier: eligibleLabels.get(event.eventId)?.tier }))
    .filter((event) => event.tier);
  const missingTrainingEvents = [...eligibleLabels.keys()].filter((eventId) => !trainData.events.has(eventId));
  if (missingTrainingEvents.length) {
    throw new Error(`${missingTrainingEvents.length} usable event labels have no matching training observation at least 2 days before TCA.`);
  }
  if (trainingEvents.length < 10) throw new Error("Not enough eligible events to train and validate the event classifier.");

  const validationEvents = [];
  const fitEvents = [];
  for (const event of trainingEvents) {
    (hashEventId(event.eventId, event.tier) % 5 === 0 ? validationEvents : fitEvents).push(event);
  }
  const events = [...fitEvents, ...validationEvents];
  const labelsByEvent = events.map((event) => event.tier);
  const fitIndexes = fitEvents.map((_, index) => index);
  const validationIndexes = validationEvents.map((_, index) => fitEvents.length + index);
  const { matrix, means, scales, featureCount } = prepareFeatures(events, fitIndexes);
  const weights = trainClassifier(matrix, labelsByEvent, fitIndexes, featureCount);
  const validationPredictions = validationIndexes.map((index) => {
    const prediction = predict(weights, matrix[index]);
    return {
      eventId: events[index].eventId,
      actualTier: events[index].tier,
      predictedTier: prediction.tier,
    };
  });
  const validationMetrics = summarizeMetrics(validationPredictions);
  const testData = await readEventObservations(resolve(testPath), "test");
  const testEvents = [...testData.events.values()];
  const testPredictions = testEvents.map((event) => {
    const categoryIndex = OBJECT_TYPES.indexOf(event.objectType);
    const vector = [1];
    for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
      const value = event.features[column];
      vector.push(Number.isFinite(value) ? (value - means[column]) / scales[column] : 0);
    }
    for (let category = 0; category < OBJECT_TYPES.length; category += 1) {
      vector.push(category === categoryIndex ? 1 : 0);
    }
    const prediction = predict(weights, vector);
    return {
      eventId: event.eventId,
      predictedTier: prediction.tier,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities,
      timeToTcaDays: event.timeToTca,
      missDistanceMeters: event.missDistanceMeters,
    };
  });
  const predictedTierCounts = Object.fromEntries(TIERS.map((tier) => [
    tier,
    testPredictions.filter((record) => record.predictedTier === tier).length,
  ]));
  const tierRank = { safe: 0, elevated: 1, critical: 2 };
  const topPredictions = [...testPredictions]
    .sort((left, right) =>
      tierRank[right.predictedTier] - tierRank[left.predictedTier] ||
      right.confidence - left.confidence ||
      left.eventId.localeCompare(right.eventId, undefined, { numeric: true }),
    )
    .slice(0, 8);

  const result = {
    source: "Workbook event labels and supplied train/test telemetry CSV files.",
    labelEvents: labels.size,
    unusableLabelEvents: [...labels.values()].filter((label) => !label.usable).length,
    training: {
      eligibleEvents: trainingEvents.length,
      fitEvents: fitEvents.length,
      classCounts: Object.fromEntries(TIERS.map((tier) => [
        tier,
        trainingEvents.filter((event) => event.tier === tier).length,
      ])),
      observationRule: "One latest observation per event with time_to_tca >= 2 days.",
    },
    validation: {
      split: "Deterministic stratified 80/20 split grouped by event_id.",
      metrics: validationMetrics,
    },
    test: {
      eventsWithEligibleObservations: testPredictions.length,
      finalLabelsAvailable: false,
      predictedTierCounts,
      topPredictions,
    },
    model: {
      algorithm: "standardized multinomial logistic regression",
      target: "final_tier",
      epochs: 160,
      classWeighting: "Inverse-frequency weights calculated from the fit split.",
      numericFeatures: NUMERIC_FEATURES,
      categoricalFeature: "c_object_type",
      objectTypes: OBJECT_TYPES,
      imputation: "Missing numeric features use fit-split means.",
      transforms: {
        distanceSpeedAndSigma: "log1p(value / 1000)",
        relativePosition: "sign(value) * log1p(abs(value) / 1000)",
      },
      numericMeans: means,
      numericScales: scales,
    },
  };
  const destination = resolve(outputPath);
  await fs.mkdir(dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(result, null, 2)}\n`);
  return { destination, result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [trainPath, labelsPath, testPath, outputPath] = process.argv.slice(2);
  if (!trainPath || !labelsPath || !testPath) {
    throw new Error(
      "Usage: node scripts/summarize-event-model.mjs <train.csv> <event-labels.csv> <test.csv> [output.json]",
    );
  }
  const { destination, result } = await buildEventModelSummary(
    trainPath,
    labelsPath,
    testPath,
    outputPath,
  );
  console.log(
    `Training: ${result.training.eligibleEvents.toLocaleString()} eligible events; validation: ${result.validation.metrics.events.toLocaleString()} grouped events, ${(result.validation.metrics.accuracy * 100).toFixed(1)}% accuracy; test: ${result.test.eventsWithEligibleObservations.toLocaleString()} event predictions (final labels unavailable).`,
  );
  console.log(`Wrote ${destination}`);
}
