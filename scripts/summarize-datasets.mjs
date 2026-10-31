import { createReadStream, promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { classifyLog10Risk } from "../src/riskPolicy.js";

const DAYS_IN_WINDOW = 1;
const DEFAULT_OUTPUT = resolve("src/data/dataset-summary.json");
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
  "F10",
  "AP",
];
const REQUIRED_COLUMNS = [
  "event_id",
  ...NUMERIC_FEATURES,
  "c_object_type",
  "risk",
];
const DESCRIPTIVE_FIELDS = [
  "risk",
  "miss_distance",
  "relative_speed",
  "time_to_tca",
];
const TIERS = ["safe", "elevated", "critical"];
const TIER_RANK = { safe: 0, elevated: 1, critical: 2 };
const HISTOGRAM_BINS = 12;

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

  if (quoted) {
    throw new Error("Unclosed quoted CSV field.");
  }

  values.push(value);
  return values;
}

function parseNumber(value) {
  if (value === undefined || value.trim() === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function transformFeature(field, value) {
  const number = parseNumber(value);
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

function classifyRisk(log10Pc, missDistanceMeters) {
  return classifyLog10Risk(log10Pc, missDistanceMeters);
}

function ensureCapacity(data, count, width, minimumCapacity) {
  if (count < minimumCapacity) return data;
  const capacity = Math.max(minimumCapacity * 2, count * 2);
  const expanded = new data.constructor(capacity * width);
  expanded.set(data);
  return expanded;
}

async function readDataset(filePath, datasetSplit, { collectTrainingData, model }) {
  const stats = Object.fromEntries(
    DESCRIPTIVE_FIELDS.map((field) => [
      field,
      { count: 0, missing: 0, min: Infinity, max: -Infinity, sum: 0 },
    ]),
  );
  const featureMissing = Object.fromEntries(
    REQUIRED_COLUMNS.filter((field) => NUMERIC_FEATURES.includes(field)).map(
      (field) => [field, 0],
    ),
  );
  const objectTypes = new Set();
  const objectTypeCounts = {};
  const riskHistogramValues = [];
  const actualTierCounts = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  const windowEvents = new Map();
  const eventIds = new Set();
  const topTargets = [];
  const topPredictions = new Map();
  const actualConfusion = Object.fromEntries(
    TIERS.map((tier) => [tier, Object.fromEntries(TIERS.map((item) => [item, 0]))]),
  );
  const predictionTotals = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  const actualTotals = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  let trainingFeatures = collectTrainingData
    ? new Float64Array(1024 * NUMERIC_FEATURES.length)
    : undefined;
  let trainingTargets = collectTrainingData ? new Float64Array(1024) : undefined;
  let trainingCategories = collectTrainingData ? new Uint8Array(1024) : undefined;
  let header;
  let fieldIndices;
  let rows = 0;
  let labeledRows = 0;
  let predictions = 0;
  let absoluteError = 0;
  let squaredError = 0;
  let sumActual = 0;
  let sumSquaredActual = 0;
  let actualTargetMin = Infinity;
  let actualTargetMax = -Infinity;
  let minimumTimeToTca = Infinity;
  let maximumTimeToTca = -Infinity;
  let eventWindowRows = 0;
  let dangerousDistanceRows = 0;
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      if (header === undefined) {
        header = parseCsvLine(line);
        const missing = REQUIRED_COLUMNS.filter((field) => !header.includes(field));
        if (missing.length) {
          throw new Error(`${filePath} is missing required columns: ${missing.join(", ")}`);
        }
        fieldIndices = Object.fromEntries(
          REQUIRED_COLUMNS.concat(DESCRIPTIVE_FIELDS).map((field) => [
            field,
            header.indexOf(field),
          ]),
        );
        continue;
      }

      if (line.length === 0) continue;

      const values = parseCsvLine(line);
      rows += 1;
      if (values.length !== header.length) {
        throw new Error(
          `${filePath}, row ${rows + 1}: found ${values.length} columns; expected ${header.length}.`,
        );
      }

      const valueFor = (field) => values[fieldIndices[field]];
      const eventId = valueFor("event_id");
      if (!eventId) {
        throw new Error(`${filePath}, row ${rows + 1}: event_id is empty.`);
      }
      eventIds.add(eventId);

      const target = parseNumber(valueFor("risk"));
      if (!Number.isFinite(target)) {
        throw new Error(`${filePath}, row ${rows + 1}: risk target is missing or invalid.`);
      }
      labeledRows += 1;
      riskHistogramValues.push(target);
      actualTargetMin = Math.min(actualTargetMin, target);
      actualTargetMax = Math.max(actualTargetMax, target);

      const missDistance = parseNumber(valueFor("miss_distance"));
      const timeToTca = parseNumber(valueFor("time_to_tca"));
      const relativeSpeed = parseNumber(valueFor("relative_speed"));
      minimumTimeToTca = Math.min(minimumTimeToTca, timeToTca);
      maximumTimeToTca = Math.max(maximumTimeToTca, timeToTca);

      for (const field of DESCRIPTIVE_FIELDS) {
        const number = parseNumber(valueFor(field));
        const fieldStats = stats[field];
        if (!Number.isFinite(number)) {
          fieldStats.missing += 1;
          continue;
        }
        fieldStats.count += 1;
        fieldStats.min = Math.min(fieldStats.min, number);
        fieldStats.max = Math.max(fieldStats.max, number);
        fieldStats.sum += number;
      }

      const rawObjectType = valueFor("c_object_type").trim().toUpperCase();
      const objectType = OBJECT_TYPES.includes(rawObjectType)
        ? rawObjectType
        : "UNKNOWN";
      objectTypes.add(objectType);
      objectTypeCounts[objectType] = (objectTypeCounts[objectType] || 0) + 1;

      const actualTier = classifyRisk(target, missDistance);
      actualTierCounts[actualTier] += 1;
      actualTotals[actualTier] += 1;

      const record = {
        row: rows,
        eventId,
        risk: target,
        missDistance,
        relativeSpeed,
        timeToTca,
      };
      topTargets.push(record);
      topTargets.sort((a, b) => b.risk - a.risk || a.row - b.row);
      if (topTargets.length > 8) topTargets.pop();

      const rawFeatures = NUMERIC_FEATURES.map((field) => {
        const featureValue = transformFeature(field, valueFor(field));
        if (!Number.isFinite(featureValue)) featureMissing[field] += 1;
        return featureValue;
      });

      if (collectTrainingData) {
        const index = rows - 1;
        if (index >= trainingTargets.length) {
          const previousCapacity = trainingTargets.length;
          trainingTargets = ensureCapacity(
            trainingTargets,
            previousCapacity,
            1,
            previousCapacity,
          );
          trainingFeatures = ensureCapacity(
            trainingFeatures,
            previousCapacity,
            NUMERIC_FEATURES.length,
            previousCapacity,
          );
          trainingCategories = ensureCapacity(
            trainingCategories,
            previousCapacity,
            1,
            previousCapacity,
          );
        }
        for (let column = 0; column < rawFeatures.length; column += 1) {
          trainingFeatures[index * rawFeatures.length + column] = rawFeatures[column];
        }
        trainingTargets[index] = target;
        trainingCategories[index] = OBJECT_TYPES.indexOf(objectType);
      }

      let predictedRisk;
      if (model) {
        predictedRisk = predictLog10Pc(rawFeatures, objectType, model);
        predictions += 1;
        const actualPc = 10 ** target;
        const predictedPc = 10 ** predictedRisk;
        const error = predictedRisk - target;
        absoluteError += Math.abs(error);
        squaredError += error * error;
        sumActual += target;
        sumSquaredActual += target * target;

        const predictedTier = classifyRisk(predictedRisk, missDistance);
        actualConfusion[actualTier][predictedTier] += 1;
        predictionTotals[predictedTier] += 1;

        const predictionRecord = {
          row: rows,
          eventId,
          actualRisk: target,
          predictedRisk,
          predictedPc,
          actualPc,
          missDistanceMeters: missDistance,
          relativeSpeed,
          timeToTcaDays: timeToTca,
          actualTier,
          predictedTier,
        };
        const previous = topPredictions.get(eventId);
        if (!previous || predictionRecord.predictedRisk > previous.predictedRisk) {
          topPredictions.set(eventId, predictionRecord);
        }
      }

      if (timeToTca >= 0 && timeToTca <= DAYS_IN_WINDOW) {
        eventWindowRows += 1;
        if (missDistance <= 5000) dangerousDistanceRows += 1;

        let event = windowEvents.get(eventId);
        if (!event) {
          event = {
            highestActualTier: "safe",
            highestPredictedTier: "safe",
            minimumMissDistanceMeters: Infinity,
            nearestTcaDays: Infinity,
            rows: 0,
          };
          windowEvents.set(eventId, event);
        }
        event.rows += 1;
        event.minimumMissDistanceMeters = Math.min(
          event.minimumMissDistanceMeters,
          missDistance,
        );
        event.nearestTcaDays = Math.min(event.nearestTcaDays, timeToTca);
        if (TIER_RANK[actualTier] > TIER_RANK[event.highestActualTier]) {
          event.highestActualTier = actualTier;
        }
        if (predictedRisk !== undefined) {
          const predictedTier = classifyRisk(predictedRisk, missDistance);
          if (TIER_RANK[predictedTier] > TIER_RANK[event.highestPredictedTier]) {
            event.highestPredictedTier = predictedTier;
          }
        }
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }

  if (!header || rows === 0) {
    throw new Error(`${filePath} is empty or has no data rows.`);
  }

  const statsSummary = Object.fromEntries(
    Object.entries(stats).map(([field, value]) => [
      field,
      {
        count: value.count,
        missing: value.missing,
        min: value.count ? value.min : null,
        max: value.count ? value.max : null,
        mean: value.count ? value.sum / value.count : null,
      },
    ]),
  );

  const eventRecords = [...windowEvents.values()];
  const warningWindow = {
    horizonHours: DAYS_IN_WINDOW * 24,
    timeUnit: "days",
    observedRecords: eventWindowRows,
    uniqueConjunctions: eventRecords.length,
    withinFiveKmRows: dangerousDistanceRows,
    withinFiveKmConjunctions: eventRecords.filter(
      (event) => event.minimumMissDistanceMeters <= 5000,
    ).length,
    withinOneKmConjunctions: eventRecords.filter(
      (event) => event.minimumMissDistanceMeters < 1000,
    ).length,
    criticalConjunctions: eventRecords.filter(
      (event) => event.highestActualTier === "critical",
    ).length,
    elevatedConjunctions: eventRecords.filter(
      (event) => event.highestActualTier === "elevated",
    ).length,
    actionableConjunctions: eventRecords.filter(
      (event) => event.highestActualTier !== "safe",
    ).length,
  };
  if (model) {
    warningWindow.predictedCriticalConjunctions = eventRecords.filter(
      (event) => event.highestPredictedTier === "critical",
    ).length;
    warningWindow.predictedElevatedConjunctions = eventRecords.filter(
      (event) => event.highestPredictedTier === "elevated",
    ).length;
    warningWindow.predictedActionableConjunctions = eventRecords.filter(
      (event) => event.highestPredictedTier !== "safe",
    ).length;
  }

  const split = {
    split: datasetSplit,
    fileName: filePath.split(/[\\/]/).at(-1),
    rows,
    columns: header.length,
    csvColumns: header,
    featureColumns: NUMERIC_FEATURES.length + 1,
    uniqueConjunctions: eventIds.size,
    objectTypes: objectTypeCounts,
    featureMissing,
    target: { field: "risk", labeledRows, missingRows: rows - labeledRows },
    stats: statsSummary,
    actualTierCounts,
    warningWindow,
    topRiskObservations: topTargets,
    topPredictions: [...topPredictions.values()]
      .sort((a, b) => b.predictedRisk - a.predictedRisk || a.row - b.row)
      .slice(0, 8),
    riskHistogramValues,
    timeRangeDays: {
      min: minimumTimeToTca,
      max: maximumTimeToTca,
    },
  };

  if (collectTrainingData) {
    split.riskValues = trainingTargets.slice(0, rows);
    split.trainingFeatures = trainingFeatures.slice(0, rows * NUMERIC_FEATURES.length);
    split.trainingCategories = trainingCategories.slice(0, rows);
  }
  if (model) {
    const classMetrics = Object.fromEntries(
      TIERS.map((tier) => {
        const truePositive = actualConfusion[tier][tier];
        const falseNegative = TIERS.reduce(
          (sum, prediction) =>
            sum + (prediction === tier ? 0 : actualConfusion[tier][prediction]),
          0,
        );
        const falsePositive = TIERS.reduce(
          (sum, actual) =>
            sum + (actual === tier ? 0 : actualConfusion[actual][tier]),
          0,
        );
        const precision = truePositive + falsePositive
          ? truePositive / (truePositive + falsePositive)
          : 0;
        const recall = truePositive + falseNegative
          ? truePositive / (truePositive + falseNegative)
          : 0;
        return [
          tier,
          {
            actualRows: actualTotals[tier],
            predictedRows: predictionTotals[tier],
            precision,
            recall,
            f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
          },
        ];
      }),
    );
    const correct = TIERS.reduce((sum, tier) => sum + actualConfusion[tier][tier], 0);
    const meanActual = sumActual / predictions;
    const totalSquaredError =
      sumSquaredActual - predictions * meanActual * meanActual;
    split.modelEvaluation = {
      rows: predictions,
      uniqueConjunctions: eventIds.size,
      meanAbsoluteError: absoluteError / predictions,
      rootMeanSquaredError: Math.sqrt(squaredError / predictions),
      rSquared: totalSquaredError > 0
        ? 1 - squaredError / totalSquaredError
        : null,
      accuracy: correct / predictions,
      classMetrics,
      confusionMatrix: actualConfusion,
      trueLabelRows: labeledRows,
      predictedRows: predictions,
    };
  }

  return split;
}

function buildModel(training, ridge = 0.25) {
  const dimensions = 1 + NUMERIC_FEATURES.length + OBJECT_TYPES.length;
  const rows = training.rows;
  const numericMeans = Array(NUMERIC_FEATURES.length).fill(0);
  const numericScales = Array(NUMERIC_FEATURES.length).fill(1);

  for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
    let count = 0;
    let sum = 0;
    for (let row = 0; row < rows; row += 1) {
      const value = training.trainingFeatures[row * NUMERIC_FEATURES.length + column];
      if (Number.isFinite(value)) {
        count += 1;
        sum += value;
      }
    }
    const mean = count ? sum / count : 0;
    numericMeans[column] = mean;
    let sumSquaredDifference = 0;
    for (let row = 0; row < rows; row += 1) {
      const value = training.trainingFeatures[row * NUMERIC_FEATURES.length + column];
      if (Number.isFinite(value)) sumSquaredDifference += (value - mean) ** 2;
    }
    const standardDeviation = count
      ? Math.sqrt(sumSquaredDifference / count)
      : 1;
    numericScales[column] = standardDeviation > 1e-12 ? standardDeviation : 1;
  }

  const gram = new Float64Array(dimensions * dimensions);
  const rightHandSide = new Float64Array(dimensions);
  const vector = new Float64Array(dimensions);

  for (let row = 0; row < rows; row += 1) {
    vector.fill(0);
    vector[0] = 1;
    for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
      const raw = training.trainingFeatures[row * NUMERIC_FEATURES.length + column];
      vector[column + 1] = Number.isFinite(raw)
        ? (raw - numericMeans[column]) / numericScales[column]
        : 0;
    }
    vector[1 + NUMERIC_FEATURES.length + training.trainingCategories[row]] = 1;

    const target = training.riskValues[row];
    for (let left = 0; left < dimensions; left += 1) {
      const leftValue = vector[left];
      rightHandSide[left] += leftValue * target;
      for (let right = 0; right <= left; right += 1) {
        gram[left * dimensions + right] += leftValue * vector[right];
      }
    }
  }

  const augmented = Array.from({ length: dimensions }, (_, row) => {
    const values = Array.from({ length: dimensions + 1 }, (_, column) => {
      if (column === dimensions) return rightHandSide[row];
      const left = Math.max(row, column);
      const right = Math.min(row, column);
      return (
        gram[left * dimensions + right] +
        (row === column ? (row === 0 ? 1e-8 : ridge) : 0)
      );
    });
    return values;
  });

  for (let column = 0; column < dimensions; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < dimensions; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }
    if (Math.abs(augmented[pivotRow][column]) < 1e-12) {
      throw new Error("Training could not solve the telemetry regression model.");
    }
    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];
    const pivot = augmented[column][column];
    for (let entry = column; entry <= dimensions; entry += 1) {
      augmented[column][entry] /= pivot;
    }
    for (let row = 0; row < dimensions; row += 1) {
      if (row === column) continue;
      const multiple = augmented[row][column];
      for (let entry = column; entry <= dimensions; entry += 1) {
        augmented[row][entry] -= multiple * augmented[column][entry];
      }
    }
  }

  return {
    algorithm: "standardized ridge regression",
    target: "risk = log10(Pc)",
    trainRows: rows,
    ridge,
    numericFeatures: NUMERIC_FEATURES,
    categoricalFeature: "c_object_type",
    objectTypes: OBJECT_TYPES,
    imputation: "Missing numeric feature values use the training-split mean.",
    transforms: {
      distanceSpeedAndSigma: "log1p(value / 1000)",
      relativePosition: "sign(value) * log1p(abs(value) / 1000)",
      timeToTca: "days",
      maximumRiskEstimate: "unchanged",
      spaceWeather: "unchanged",
    },
    numericMeans,
    numericScales,
    coefficients: augmented.map((row) => row[dimensions]),
    minimumTarget: training.stats.risk.min,
    maximumTarget: training.stats.risk.max,
  };
}

function predictLog10Pc(rawFeatures, objectType, model) {
  let estimate = model.coefficients[0];
  for (let column = 0; column < NUMERIC_FEATURES.length; column += 1) {
    const raw = rawFeatures[column];
    const standardized = Number.isFinite(raw)
      ? (raw - model.numericMeans[column]) / model.numericScales[column]
      : 0;
    estimate += model.coefficients[column + 1] * standardized;
  }
  const objectTypeIndex = model.objectTypes.indexOf(objectType);
  if (objectTypeIndex >= 0) {
    estimate += model.coefficients[1 + NUMERIC_FEATURES.length + objectTypeIndex];
  }
  return Math.min(model.maximumTarget, Math.max(model.minimumTarget, estimate));
}

function summarizeHistogram(split, minimum, maximum) {
  const range = maximum - minimum;
  const bins = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
    from: minimum + (range * index) / HISTOGRAM_BINS,
    to: minimum + (range * (index + 1)) / HISTOGRAM_BINS,
    count: 0,
  }));
  for (const value of split.riskHistogramValues) {
    const index =
      range === 0
        ? 0
        : Math.min(
            HISTOGRAM_BINS - 1,
            Math.floor(((value - minimum) / range) * HISTOGRAM_BINS),
          );
    bins[index].count += 1;
  }
  delete split.riskHistogramValues;
  return bins;
}

export async function buildDatasetSummary(
  trainPath,
  testPath,
  outputPath = DEFAULT_OUTPUT,
) {
  const training = await readDataset(resolve(trainPath), "train", {
    collectTrainingData: true,
  });
  const model = buildModel(training);
  const test = await readDataset(resolve(testPath), "test", { model });
  if (
    training.csvColumns.length !== test.csvColumns.length ||
    training.csvColumns.some((column, index) => column !== test.csvColumns[index])
  ) {
    throw new Error("Training and test CSV files must use the same column schema and order.");
  }
  const histogramMinimum = Math.min(
    training.stats.risk.min,
    test.stats.risk.min,
  );
  const histogramMaximum = Math.max(
    training.stats.risk.max,
    test.stats.risk.max,
  );

  training.riskHistogram = summarizeHistogram(
    training,
    histogramMinimum,
    histogramMaximum,
  );
  test.riskHistogram = summarizeHistogram(test, histogramMinimum, histogramMaximum);
  delete training.riskHistogramValues;
  delete training.riskValues;
  delete training.trainingFeatures;
  delete training.trainingCategories;
  delete training.csvColumns;
  delete test.csvColumns;

  const result = {
    source: "Collision Avoidance Challenge train/test CSV files.",
    features: {
      columns: [...NUMERIC_FEATURES, "c_object_type"],
      target: "risk (log10(Pc))",
      excluded: ["event_id is used only to count unique conjunctions."],
    },
    riskAxis: {
      min: histogramMinimum,
      max: histogramMaximum,
    },
    policy: {
      probabilitySafe: 1e-6,
      probabilityCritical: 1e-4,
      criticalMissDistanceKm: 1,
      safeMissDistanceKm: 5,
      units: {
        missDistance: "meters in CSV; kilometers in UI thresholds",
        timeToTca: "days in CSV",
      },
      note: "Screening thresholds supplied in the project brief; confirm against the mission-approved conjunction policy before operational use.",
    },
    model,
    splits: { train: training, test },
  };
  const destination = resolve(outputPath);
  await fs.mkdir(dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(result, null, 2)}\n`);
  return { destination, result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [trainPath, testPath, outputPath] = process.argv.slice(2);
  if (!trainPath || !testPath) {
    throw new Error(
      "Usage: node scripts/summarize-datasets.mjs <train.csv> <test.csv> [output.json]",
    );
  }
  const { destination, result } = await buildDatasetSummary(
    trainPath,
    testPath,
    outputPath,
  );
  for (const split of Object.values(result.splits)) {
    const metrics = split.modelEvaluation;
    console.log(
      `${split.split}: ${split.rows.toLocaleString()} messages, ${split.uniqueConjunctions.toLocaleString()} unique conjunctions, ${split.warningWindow.uniqueConjunctions} unique conjunctions within 24 hours, ${split.warningWindow.actionableConjunctions} actionable conjunctions in that window.`,
    );
    if (metrics) {
      console.log(
        `Test evaluation: MAE ${metrics.meanAbsoluteError.toFixed(3)} log10(Pc), accuracy ${(metrics.accuracy * 100).toFixed(1)}%, critical recall ${(metrics.classMetrics.critical.recall * 100).toFixed(1)}%.`,
      );
    }
  }
  console.log(`Wrote ${destination}`);
}
