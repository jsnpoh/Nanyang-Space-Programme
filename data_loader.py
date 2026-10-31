"""Local-only ingestion and event-level dataset preparation for Challenge 1."""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

import pandas as pd

EVENT_ID = "event_id"
NUMERIC_FEATURES = (
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
)
CATEGORICAL_FEATURES = ("c_object_type",)
MODEL_FEATURES = (*NUMERIC_FEATURES, *CATEGORICAL_FEATURES)
ALLOWED_COLUMNS = (EVENT_ID, *MODEL_FEATURES, "risk")
LABEL_COLUMNS = (
    EVENT_ID,
    "final_risk_log10_pc",
    "final_miss_distance_m",
    "final_tier",
    "usable_for_training",
)


def _source_bytes(source: Any) -> bytes:
    if isinstance(source, (str, Path)):
        return Path(source).read_bytes()
    if hasattr(source, "getvalue"):
        return source.getvalue()
    if hasattr(source, "read"):
        content = source.read()
        if isinstance(content, str):
            return content.encode("utf-8")
        return content
    raise TypeError("Expected a file path or uploaded CSV file.")


def _decode(source: Any) -> str:
    try:
        return _source_bytes(source).decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("CSV must use UTF-8 encoding.") from error


def load_cdm_data(source: Any) -> pd.DataFrame:
    """Read only the approved CDM fields; event_id is retained for grouping only."""
    text = _decode(source)
    reader = csv.reader(io.StringIO(text))
    try:
        header = [column.strip() for column in next(reader)]
    except StopIteration as error:
        raise ValueError("The selected CDM CSV is empty.") from error
    if len(set(header)) != len(header):
        raise ValueError("CDM CSV contains duplicate column names.")

    missing = [column for column in (EVENT_ID, *MODEL_FEATURES) if column not in header]
    if missing:
        raise ValueError(f"CDM CSV is missing required fields: {', '.join(missing)}.")
    selected = [column for column in ALLOWED_COLUMNS if column in header]
    allowed = set(selected)
    frame = pd.read_csv(
        io.StringIO(text),
        usecols=lambda column: column.strip() in allowed,
        dtype_backend="numpy_nullable",
    )
    frame.columns = [column.strip() for column in frame.columns]
    frame[EVENT_ID] = frame[EVENT_ID].astype("string").str.strip()
    for column in NUMERIC_FEATURES:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    if "risk" in frame:
        frame["risk"] = pd.to_numeric(frame["risk"], errors="coerce")
    frame["c_object_type"] = frame["c_object_type"].fillna("UNKNOWN").str.strip()
    if frame[EVENT_ID].isna().any() or frame[EVENT_ID].eq("").any():
        raise ValueError("CDM CSV contains an empty event_id.")
    if frame.empty:
        raise ValueError("The selected CDM CSV has no data rows.")
    return frame.loc[:, selected]


def load_event_labels(source: Any) -> pd.DataFrame:
    """Find the workbook-export header after its explanatory preamble."""
    text = _decode(source)
    reader = csv.reader(io.StringIO(text))
    header_row = None
    for index, row in enumerate(reader):
        normalized = {column.strip() for column in row}
        if set(LABEL_COLUMNS).issubset(normalized):
            header_row = index
            break
    if header_row is None:
        raise ValueError(
            "Event-label CSV must include event_id, final_risk_log10_pc, "
            "final_miss_distance_m, final_tier, and usable_for_training."
        )

    lines = text.splitlines()
    header = [column.strip() for column in next(csv.reader([lines[header_row]]))]
    if len(set(header)) != len(header):
        raise ValueError("Event-label CSV contains duplicate column names.")
    labels = pd.read_csv(
        io.StringIO("\n".join(lines[header_row:])),
        usecols=list(LABEL_COLUMNS),
        dtype={EVENT_ID: "string"},
    )
    labels.columns = [column.strip() for column in labels.columns]
    labels[EVENT_ID] = labels[EVENT_ID].str.strip()
    labels["final_risk_log10_pc"] = pd.to_numeric(
        labels["final_risk_log10_pc"], errors="coerce"
    )
    labels["final_miss_distance_m"] = pd.to_numeric(
        labels["final_miss_distance_m"], errors="coerce"
    )
    labels["final_tier"] = labels["final_tier"].str.strip().str.lower()
    labels["usable_for_training"] = (
        labels["usable_for_training"].str.strip().str.lower().eq("yes")
    )
    if labels[EVENT_ID].isna().any() or labels[EVENT_ID].eq("").any():
        raise ValueError("Event-label CSV contains an empty event_id.")
    if labels[EVENT_ID].duplicated().any():
        raise ValueError("Event-label CSV contains duplicate event_id values.")
    return labels


def _latest_eligible_cdm(cdm: pd.DataFrame) -> pd.DataFrame:
    eligible = cdm.loc[
        cdm["time_to_tca"].ge(2.0) & cdm[EVENT_ID].notna()
    ].copy()
    if eligible.empty:
        raise ValueError("No CDMs have a valid time_to_tca of at least 2 days.")
    return (
        eligible.sort_values("time_to_tca", kind="stable")
        .drop_duplicates(EVENT_ID, keep="first")
        .reset_index(drop=True)
    )


def prepare_training_events(
    cdm: pd.DataFrame, labels: pd.DataFrame
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Join train-only final labels to the latest eligible pre-TCA CDM per event."""
    eligible_labels = labels.loc[labels["usable_for_training"]].copy()
    if eligible_labels.empty:
        raise ValueError("No event labels are marked usable_for_training=yes.")
    if not eligible_labels["final_tier"].isin(("safe", "elevated", "critical")).all():
        raise ValueError("Eligible labels contain an unknown final_tier value.")
    if eligible_labels[
        ["final_risk_log10_pc", "final_miss_distance_m"]
    ].isna().any().any():
        raise ValueError("Eligible labels contain a missing final risk or miss distance.")

    candidates = _latest_eligible_cdm(cdm)
    merged = eligible_labels.merge(
        candidates,
        on=EVENT_ID,
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    missing_cdm = int(merged["_merge"].ne("both").sum())
    merged = merged.loc[merged["_merge"].eq("both")].drop(columns="_merge")
    if merged.empty:
        raise ValueError("No eligible event labels match training CDMs.")

    from risk_policy import classify_risk

    derived_tiers = [
        classify_risk(risk, distance)
        for risk, distance in zip(
            merged["final_risk_log10_pc"],
            merged["final_miss_distance_m"],
            strict=True,
        )
    ]
    mismatch = [
        event_id
        for event_id, derived, labeled in zip(
            merged[EVENT_ID], derived_tiers, merged["final_tier"], strict=True
        )
        if derived != labeled
    ]
    if mismatch:
        raise ValueError(
            "Workbook final_tier does not match the Challenge 1 risk rules for "
            f"{len(mismatch)} eligible events (e.g. event {mismatch[0]})."
        )

    merged["risk"] = merged["final_risk_log10_pc"]
    merged["tier"] = merged["final_tier"]
    merged["miss_distance"] = pd.to_numeric(merged["miss_distance"], errors="coerce")
    stats = {
        "eligible_label_events": int(len(eligible_labels)),
        "events_with_2d_cdm": int(len(merged)),
        "eligible_events_without_cdm": missing_cdm,
        "excluded_unusable_labels": int((~labels["usable_for_training"]).sum()),
        "excluded_early_only_events": int(
            eligible_labels[EVENT_ID].isin(candidates[EVENT_ID]).eq(False).sum()
        ),
    }
    return merged.reset_index(drop=True), stats


def prepare_test_events(cdm: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return one prediction row per test event plus all untouched test CDMs."""
    selected = _latest_eligible_cdm(cdm)
    return selected, cdm.copy()
