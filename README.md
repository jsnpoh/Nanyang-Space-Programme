# Nanyang Space Programme

Satellite conjunction-risk evaluator and dataset dashboard. The supplied
training split fits a telemetry regression model for `risk = log10(Pc)`; the
separate test split measures model error and risk-tier classifications.

## Run the dashboard

```powershell
npm install
npm run dev
```

The dataset explorer reads `src/data/dataset-summary.json`; it does not require
the original CSVs at runtime.

## Regenerate the dataset summary

Keep the original CSV files outside the repository. From the project root, run:

```powershell
npm run data:summary -- "C:\Users\you\Downloads\train_data.csv" "C:\Users\you\Downloads\test_data.csv"
```

This streams the CSV files locally, trains the compact ridge-regression model,
evaluates it against the test split, and updates
`src/data/dataset-summary.json`. The source datasets are not copied into the
website or uploaded by this script.

The model uses only the permitted inputs: `time_to_tca`, `miss_distance`,
`relative_speed`, `relative_position_r`, `relative_position_t`,
`relative_position_n`, `c_object_type`, `c_sigma_r`, `t_sigma_r`,
`max_risk_estimate`, `F10`, and `AP`. `event_id` is used only to count unique
conjunctions, and `risk` is the supervised target. Numeric missing values are
imputed with training-split means. The evaluator maps
`risk` to `Pc = 10 ** risk`; risk tiers use the thresholds provided in the
project brief.

Time-to-TCA values are interpreted as days, and miss-distance values are
interpreted as meters. Twenty-four-hour warning counts are deduplicated by
event ID. Test metrics are calculated per telemetry row; repeated messages
for an event mean they are not independent-event metrics. The test data starts
more than 24 hours before TCA, so it may correctly contain zero 24-hour test
warnings.

The UI also includes clickable and automated safe/elevated/critical boundary
test cases. Run the tests and production build with:

```powershell
npm test
npm run build
```

These are screening/demo outputs, not flight-certified maneuver advice. The
thresholds in the project brief should be checked against the actual mission
conjunction policy and referenced NASA/ESA guidance before operational use.
