# Nanyang Space Programme

Satellite conjunction-risk evaluator and dataset dashboard. The event-level
classifier predicts workbook `final_tier` labels from eligible pre-approach
telemetry. The separate test split is used for predictions only because its
final event outcomes are not provided.

## Run the dashboard

```powershell
npm install
npm run dev
```

The dataset explorer reads `src/data/dataset-summary.json`, and the event-tier
model reads `src/data/event-model-summary.json`; neither requires the original
CSVs at runtime.

## Regenerate the dataset summary

Keep the original CSV files outside the repository. From the project root, run:

```powershell
npm run data:summary -- "C:\Users\you\Downloads\train_data.csv" "C:\Users\you\Downloads\test_data.csv"
```

This streams the CSV files locally and updates the raw telemetry statistics in
`src/data/dataset-summary.json`. The source datasets are not copied into the
website or uploaded by this script. The dashboard's event-tier classifier is
generated separately as described below.

The raw telemetry summary uses the permitted inputs: `time_to_tca`, `miss_distance`,
`relative_speed`, `relative_position_r`, `relative_position_t`,
`relative_position_n`, `c_object_type`, `c_sigma_r`, `t_sigma_r`,
`max_risk_estimate`, `F10`, and `AP`. `event_id` is used only to count unique
conjunctions, and raw `risk` values are summarized as message-level data.
Numeric missing values are imputed with training-split means. The separate
event classifier uses the workbook `final_tier` labels, as described below.

Time-to-TCA values are interpreted as days, and miss-distance values are
interpreted as meters. Raw row-level tiers and statistics are not final
event-outcome labels. Event-level classifier validation is grouped by event ID;
test data is used for predictions only because final test outcomes are absent.

The UI also includes clickable and automated safe/elevated/critical boundary
test cases. Run the tests and production build with:

```powershell
npm test
npm run build
```

## Regenerate the event-level model

Export the workbook's `train_event_labels` sheet to CSV, then run:

```powershell
npm run data:event-model -- "C:\Users\you\Downloads\train_data.csv" "C:\Users\you\Downloads\challenge1_event_labels.csv" "C:\Users\you\Downloads\test_data.csv"
```

The script skips the workbook export's note/preamble rows, keeps events marked
`usable_for_training=yes`, and uses the latest observation per event with
`time_to_tca >= 2` days. It makes a deterministic 80/20 validation split by
event ID so messages from the same event cannot cross the split. Test event IDs
are kept separate from training labels; test outputs are predictions only, not
accuracy metrics, because test final outcomes are unavailable. The generated
`src/data/event-model-summary.json` contains validation metrics and test
prediction summaries. Source CSV files remain local and are not copied into
the app.

## Screen a new conjunction CSV

Use **Screen a new dataset** in the dashboard to choose a CSV file or a
plain-text `.txt` file containing comma-separated CSV data. Screening runs
locally in your browser; the file is not sent to a server. Excel files should
be saved/exported as CSV first. Files are limited to 50 MB and 100,000 rows.
The page shows risk-tier counts, a preview, any rows it could not screen,
and lets you download the original rows with screening results appended. This
applies the deterministic screening rules to supplied Pc/risk and distance
values; it does not retrain the AI model or estimate missing Pc values.

The CSV needs either a `pc` column containing collision probability (0–1) or a
`risk` column containing `log10(Pc)`, plus one miss-distance column:
`miss_distance_m` (meters), `miss_distance_km` (kilometers), or
`miss_distance` (meters, matching the supplied dataset). Optional columns are
`event_id` and `time_to_tca` (days); when TCA is included, the dashboard also
counts unique elevated/critical events within 24 hours. The workbook event
label export is also supported through `final_risk_log10_pc` and
`final_miss_distance_m` columns; its introductory note rows are skipped.
Headers are case-insensitive. Download the template from the upload panel for
an example.

These are screening/demo outputs, not flight-certified maneuver advice. The
thresholds in the project brief should be checked against the actual mission
conjunction policy and referenced NASA/ESA guidance before operational use.

## Challenge 1 local Python cockpit

The original React dashboard remains available with `npm run dev`. The separate
Streamlit cockpit adds the Challenge 1 event-level training workflow, test
predictions, grouped evaluation, traceable review records, and relative-trajectory
exploration. It processes uploaded files in memory or reads local file paths;
it does not transmit the source data.

Install the Python dependencies and start the cockpit from the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
# macOS: brew install libomp
python -m pip install -r requirements.txt
streamlit run app.py
```

In the sidebar, select the supplied `train_data.csv`, export the workbook's
`train_event_labels` sheet as CSV, and select `test_data.csv`. Local files named
`train_data.csv`, `test_data.csv`, and `*train_event_labels.csv` in `~/Downloads`
are detected as optional path defaults; alternatively, use the three upload
controls. Optional `ORBITAL_TRAIN_CSV`, `ORBITAL_EVENT_LABELS_CSV`, and
`ORBITAL_TEST_CSV` environment variables select other local path defaults.

### Challenge 1 modeling and audit protocol

`data_loader.py` restricts model input to the approved CDM fields and validates
the workbook's `final_tier` against its final risk/distance labels. The
event-level target is the **final event outcome**, not message-level `risk`.
Only `usable_for_training=yes` train labels are considered. For each eligible
training event, the latest available CDM with `time_to_tca >= 2` days provides
one feature row. Numeric missing values are median-imputed and surfaced as
manual-review flags.

`model_engine.py` trains seeded XGBoost regression and class-balanced
classification models. Evaluation in `evaluator.py` uses a deterministic
stratified 80/20 holdout grouped by `event_id`; an event cannot occur in both
folds. The held-out regressor and classifier are each compared with the
`max_risk_estimate` regression and deterministic tier-rule baselines. Test
events are never joined to train labels: their IDs restart, and final test
outcomes are unavailable. The dashboard states this limitation explicitly.

The exact rules are Critical when final `risk >= -4` or miss distance is under
1,000 m; Elevated when not Critical and (`risk >= -6` or miss distance is at
most 5,000 m); otherwise Safe. `risk = -30` is the challenge's approximate-zero
Pc placeholder. The warning horizon includes future events with
`0 <= time_to_tca <= 1` day; it does not apply the separate two-day training
cutoff to event time or change the dataset's units.

The test dataset starts 2–7 days before closest approach. Consequently, its
24-hour warning count is correctly empty; upload a current CDM CSV snapshot to
populate the operational watch. Current CDMs within 24 hours are screened
independently using deterministic rule thresholds rather than extrapolating the
ML model outside its training window. The app shows observed relative position
`(r,t,n)` and only the supplied radial `c_sigma_r` / `t_sigma_r` uncertainty
inputs. No full relative 3×3 covariance matrix or cross-covariance terms are in
the allowlisted inputs, so it does not invent an uncertainty ellipse or claim
to calculate operational Pc.

Low classifier confidence, disagreement with the rule baseline, incomplete
fallback evidence, a close approach, or a TCA within 24 hours raises a manual
review flag. Model scores are uncalibrated, and the fallback is screening only:
the app never issues or executes a maneuver command. Validation errors and
prediction audits can be exported; requested local audit-log writes append
JSON lines to ignored `artifacts/decision-support.jsonl`.

Run the Python unit tests, including exact threshold boundaries, preamble-aware
label ingestion, event-ID isolation, deterministic predictions, rule fallbacks,
warning windows, and grouped validation, with:

```bash
python -m unittest discover -s tests -v
```

### Measured holdout results

The supplied train CSV and workbook event-label export produce 11,942 eligible
training events after matching labels to CDMs at least 2 days before TCA. With
seed 42 and a stratified, event-grouped 80/20 split, the validation fold has
2,389 events (1,789 Safe, 433 Elevated, 167 Critical). The final-tier XGBoost
classifier scores **92.3% accuracy** and **88.2% balanced accuracy**. The
deterministic `max_risk_estimate` classifier baseline scores 76.2% accuracy
and 81.5% balanced accuracy. Critical recall is **86.8%** (145/167) for XGBoost
versus **86.2%** (144/167) for the baseline. The classifier missed **22
Critical** validation events; the dashboard surfaces those false negatives,
and the predicted tier falls back to the rule baseline whenever the classifier
disagrees with it.

In this holdout, all 22 missed Critical events had a final miss distance below
1 km, while 3 already had a pre-TCA observation over 5 km. This shows why an
early geometry snapshot cannot always anticipate the final closest approach;
the dashboard places the early and final miss distances side by side and
escalates these failures for later CDM and qualified operator review.

On the same held-out events, XGBoost final-risk regression MAE is **4.292
log10(Pc)** (RMSE 6.296), compared with baseline MAE **16.664** (RMSE 19.272)
for the latest eligible message's `max_risk_estimate`. The `risk = -30` near-zero
placeholder is frequent and makes raw log-probability error hard to interpret;
these metrics do not establish calibrated Pc or safety.

The evaluation addresses a narrow current workflow: a flight-dynamics operator
triaging CDMs and deciding which conjunction records need qualified review.
The prototype compares an event-level prediction with the existing max-risk
estimate and deterministic threshold screen, highlights critical false
negatives and model/baseline disagreements, and produces a reviewable report
instead of issuing a maneuver. The measured scores describe this particular
held-out split only; no operator time savings, flight performance, or
NASA/ESA-policy approval is claimed.

For a focused three-minute demo: identify the operator and the 2-day warning
constraint; show the eligible-event counts and leakage-safe split; compare
critical recall and the confusion matrix against the rule baseline; inspect
the 22 critical misses; open the test prediction / relative-position views;
then generate one traceable report and point out the required human decision.
