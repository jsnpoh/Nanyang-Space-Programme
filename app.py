"""Local Streamlit dashboard for the Airbus Autonomous SG Challenge 1."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from data_loader import (
    ALLOWED_COLUMNS,
    EVENT_ID,
    load_cdm_data,
    load_event_labels,
    prepare_test_events,
    prepare_training_events,
)
from evaluator import (
    build_decision_report,
    evaluate_holdout,
    report_as_markdown,
    screen_current_cdms,
    warning_events,
)
from model_engine import fit_models, predict_events
from risk_policy import TIERS

APP_ROOT = Path(__file__).resolve().parent
LOG_ROOT = APP_ROOT / "artifacts"
LOG_PATH = LOG_ROOT / "decision-support.jsonl"
logger = logging.getLogger("orbital")


st.set_page_config(
    page_title="ORBITAL · Conjunction intelligence",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
    :root { --ink:#e6edf5; --muted:#91a1b5; --teal:#58dfc2; --panel:#111d2d; }
    html, body, [class*="css"] { font-family:'DM Sans',sans-serif; }
    .stApp { background:radial-gradient(ellipse at 86% 0%,#17334a 0%,#101b2b 34%,#0b1320 73%);color:var(--ink); }
    [data-testid="stHeader"] { background:rgba(11,19,32,.88); }
    [data-testid="stSidebar"] { background:linear-gradient(180deg,#111c2c,#0d1725);border-right:1px solid rgba(151,177,204,.14); }
    [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color:#b5c3d2; }
    .block-container { max-width:1480px;padding-top:1.55rem;padding-bottom:3rem; }
    h1,h2,h3 { font-family:'Manrope',sans-serif !important;letter-spacing:-.04em; }
    h1 { font-size:clamp(2rem,4vw,3.35rem) !important;line-height:1.06 !important; }
    h2 { font-size:1.62rem !important; }
    h3 { font-size:1.15rem !important; }
    [data-testid="stMetric"] { min-height:119px;padding:19px 19px 14px;border:1px solid rgba(151,177,204,.15);border-radius:14px;background:linear-gradient(142deg,rgba(23,39,59,.96),rgba(15,27,42,.92));box-shadow:0 12px 35px rgba(0,0,0,.12); }
    [data-testid="stMetricLabel"] { color:#9eafc2; }
    [data-testid="stMetricValue"] { color:#f1f6fa;font-family:'Manrope',sans-serif; }
    [data-testid="stMetricDelta"] { color:var(--teal); }
    .hero { position:relative;overflow:hidden;padding:32px 36px;margin-bottom:20px;border:1px solid rgba(99,192,207,.24);border-radius:20px;background:linear-gradient(112deg,rgba(18,39,55,.98) 0%,rgba(17,35,52,.96) 52%,rgba(20,54,67,.76) 100%);box-shadow:0 18px 55px rgba(0,0,0,.18); }
    .hero:after { content:'◉';position:absolute;right:4.2%;top:50%;transform:translateY(-53%);font-size:clamp(8rem,18vw,16rem);font-family:'Manrope',sans-serif;font-weight:800;line-height:1;color:rgba(91,220,203,.065);pointer-events:none; }
    .hero-kicker { color:#6ee2ce;font-family:'DM Mono',monospace;font-size:.73rem;letter-spacing:.15em; }
    .hero-copy { max-width:760px;color:#a8b8c8;font-size:1.02rem;line-height:1.65; }
    .hero-badge { display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:7px 11px;border:1px solid rgba(94,219,196,.23);border-radius:99px;background:rgba(80,210,187,.07);color:#abeee0;font-size:.74rem; }
    .panel { padding:22px;border:1px solid rgba(151,177,204,.15);border-radius:15px;background:linear-gradient(150deg,rgba(19,32,49,.95),rgba(15,26,41,.93)); }
    .eyebrow { color:#7f99ac;font-family:'DM Mono',monospace;font-size:.69rem;letter-spacing:.12em; }
    .notice { padding:14px 16px;border:1px solid rgba(244,188,108,.25);border-radius:11px;background:rgba(243,175,86,.07);color:#ecd1a3;font-size:.9rem;line-height:1.55; }
    .success-note { padding:13px 15px;border:1px solid rgba(85,221,183,.22);border-radius:11px;background:rgba(71,206,171,.07);color:#a7e7d6;font-size:.87rem;line-height:1.55; }
    .danger-note { padding:13px 15px;border:1px solid rgba(255,117,127,.23);border-radius:11px;background:rgba(238,81,104,.07);color:#ffc1c3;font-size:.87rem;line-height:1.55; }
    .mono { font-family:'DM Mono',monospace; }
    .small-note { color:#91a1b5;font-size:.82rem;line-height:1.6; }
    .tier-chip { display:inline-block;padding:4px 10px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em; }
    .tier-safe { background:rgba(66,201,158,.13);color:#74e1bc; }
    .tier-elevated { background:rgba(245,191,99,.13);color:#f3ca7f; }
    .tier-critical { background:rgba(255,112,123,.14);color:#ff979f; }
    .stButton button[kind="primary"] { border:0;background:linear-gradient(110deg,#3ec6b2,#62dfbd);color:#0a1c24;font-weight:700; }
    .stButton button[kind="primary"]:hover { border:0;background:linear-gradient(110deg,#5adbc6,#91efd2); }
    div[data-testid="stTabs"] button[aria-selected="true"] { color:#63e1c8; }
    div[data-testid="stTabs"] button:hover { color:#a0f1df; }
    [data-testid="stDataFrame"] { border:1px solid rgba(151,177,204,.12);border-radius:10px;overflow:hidden; }
    hr { border-color:rgba(151,177,204,.15); }
    [data-testid="stFileUploaderDropzone"] { border:1px dashed rgba(102,212,198,.34);border-radius:11px;background:rgba(56,162,165,.035); }
    footer { visibility:hidden; }
    @media (max-width:740px) { .hero { padding:25px 22px; }.block-container { padding-left:1rem;padding-right:1rem; } }
    </style>
    """,
    unsafe_allow_html=True,
)


def _sha256(source: Any) -> str:
    if isinstance(source, (str, Path)):
        digest = hashlib.sha256()
        with Path(source).open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()
    if hasattr(source, "getvalue"):
        content = source.getvalue()
    elif hasattr(source, "read"):
        content = source.read()
        source.seek(0)
    else:
        content = repr(source).encode("utf-8")
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def _discover_download_file(pattern: str) -> str:
    candidates = sorted((Path.home() / "Downloads").glob(pattern))
    return str(candidates[0]) if candidates else ""


def _load_source(label: str, upload: Any, path: str) -> tuple[Any, str]:
    if upload is not None:
        return upload, f"Uploaded file: {upload.name} · SHA-256 `{_sha256(upload)}`"
    candidate = path.strip()
    if not candidate:
        raise ValueError(f"Choose or upload the {label} file to continue.")
    source_path = Path(candidate).expanduser()
    if not source_path.is_file():
        raise ValueError(f"{label} file not found: {source_path}")
    return source_path, f"{source_path.name} · SHA-256 `{_sha256(source_path)}`"


def _format_float(value: Any, digits: int = 3) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "—"
    return f"{number:.{digits}f}" if np.isfinite(number) else "—"


def _safe_download_json(value: Any) -> str:
    return json.dumps(value, indent=2, default=_json_default, allow_nan=False)


def _json_default(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if pd.isna(value):
        return None
    raise TypeError(f"Cannot serialize {type(value).__name__} to the audit report.")


@st.cache_data(show_spinner=False)
def _cached_training_events(train_source: Any, labels_source: Any) -> tuple[pd.DataFrame, dict[str, int]]:
    train = load_cdm_data(train_source)
    labels = load_event_labels(labels_source)
    return prepare_training_events(train, labels)


@st.cache_resource(show_spinner="Training reproducible XGBoost models on eligible events…")
def _cached_models(events: pd.DataFrame, cache_key: str) -> dict[str, Any]:
    return fit_models(events, seed=42)


@st.cache_data(show_spinner=False)
def _cached_validation(events: pd.DataFrame, cache_key: str) -> dict[str, Any]:
    return evaluate_holdout(events, seed=42)


def _render_header() -> None:
    st.markdown(
        """
        <div class="hero">
          <div class="hero-kicker">AUTONOMOUS SG 2026 · AIRBUS CHALLENGE 01</div>
          <h1>Orbital conjunction<br>intelligence.</h1>
          <div class="hero-copy">A traceable early-warning cockpit for flight-dynamics operators. Predict each conjunction’s final risk tier from CDMs at least two days before closest approach—then verify the model against a deterministic rule baseline.</div>
          <div class="hero-badge">✳ &nbsp; Human-authorized decisions · Local data only</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _render_sidebar() -> tuple[Any, Any, Any, dict[str, str]]:
    st.sidebar.markdown("## 🛰️ ORBITAL")
    st.sidebar.caption("CONJUNCTION DECISION SUPPORT · LOCAL MODE")
    st.sidebar.markdown("---")
    st.sidebar.markdown("### Data sources")
    train_upload = st.sidebar.file_uploader(
        "Training CDM CSV", type=["csv"], key="train-upload"
    )
    train_path = st.sidebar.text_input(
        "or local training-file path",
        value=os.getenv("ORBITAL_TRAIN_CSV", _discover_download_file("train_data.csv")),
        key="train-path",
    )
    label_upload = st.sidebar.file_uploader(
        "Workbook event-label CSV", type=["csv"], key="label-upload"
    )
    label_path = st.sidebar.text_input(
        "or local event-label-file path",
        value=os.getenv(
            "ORBITAL_EVENT_LABELS_CSV",
            _discover_download_file("*train_event_labels.csv"),
        ),
        key="label-path",
    )
    test_upload = st.sidebar.file_uploader(
        "Unlabeled test CDM CSV", type=["csv"], key="test-upload"
    )
    test_path = st.sidebar.text_input(
        "or local test-file path",
        value=os.getenv("ORBITAL_TEST_CSV", _discover_download_file("test_data.csv")),
        key="test-path",
    )
    live_upload = st.sidebar.file_uploader(
        "Optional upcoming CDM snapshot", type=["csv"], key="live-upload"
    )
    st.sidebar.caption(
        "All parsing and model runs stay on this machine. Test labels are never joined to train labels."
    )
    st.sidebar.markdown("---")
    st.sidebar.markdown("### Decision filters")
    selected_tiers = st.sidebar.multiselect(
        "Show risk tiers",
        options=list(TIERS),
        default=["critical", "elevated", "safe"],
        format_func=str.title,
        key="tier-filter",
    )
    minimum_distance = st.sidebar.number_input(
        "Maximum miss distance (m)",
        min_value=0,
        value=100_000,
        step=1_000,
        key="distance-filter",
    )
    maximum_tca = st.sidebar.slider(
        "Maximum time to TCA (days)",
        min_value=0.0,
        max_value=7.0,
        value=7.0,
        step=0.25,
        key="tca-filter",
    )
    return train_upload, label_upload, test_upload, {
        "train_path": train_path,
        "label_path": label_path,
        "test_path": test_path,
        "selected_tiers": selected_tiers,
        "minimum_distance": str(minimum_distance),
        "maximum_tca": str(maximum_tca),
        "live_upload": live_upload,
    }


def _figure_theme(figure: go.Figure) -> go.Figure:
    figure.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(5,13,22,.35)",
        font={"family": "DM Sans, sans-serif", "color": "#c5d2df"},
        margin={"l": 8, "r": 8, "t": 28, "b": 8},
        legend={"bgcolor": "rgba(0,0,0,0)", "orientation": "h", "y": 1.12},
        hoverlabel={"bgcolor": "#132337", "font": {"color": "#edf5fb"}},
    )
    figure.update_xaxes(
        gridcolor="rgba(150,176,200,.11)", zerolinecolor="rgba(150,176,200,.17)"
    )
    figure.update_yaxes(
        gridcolor="rgba(150,176,200,.11)", zerolinecolor="rgba(150,176,200,.17)"
    )
    return figure


def _evaluate_and_render(
    events: pd.DataFrame, labels_stats: dict[str, int], provenance: dict[str, str]
) -> dict[str, Any]:
    st.header("Validation, with the baseline in view")
    st.caption(
        "One deterministic, stratified 80/20 split grouped by event ID. "
        "All scores target the workbook’s FINAL event outcome—not an intermediate telemetry-row label."
    )
    cache_key = provenance["train_sha256"] + provenance["labels_sha256"]
    result = _cached_validation(events, cache_key)
    model_metrics = result["classification"]["model"]
    baseline_metrics = result["classification"]["baseline_max_risk_estimate"]
    regression = result["regression"]
    model_regression = regression["model"]
    baseline_regression = regression["baseline_max_risk_estimate"]

    metrics = st.columns(5)
    metrics[0].metric(
        "Validation events", f"{result['validation_events']:,}", "20% · event-disjoint"
    )
    metrics[1].metric(
        "Tier balanced accuracy",
        f"{model_metrics['balanced_accuracy']:.1%}",
        f"{model_metrics['balanced_accuracy'] - baseline_metrics['balanced_accuracy']:+.1%} vs baseline",
    )
    critical_recall = model_metrics["per_class"]["critical"]["recall"]
    critical_precision = model_metrics["per_class"]["critical"]["precision"]
    metrics[2].metric("Critical recall", f"{critical_recall:.1%}", "Missed critical events matter")
    metrics[3].metric(
        "Final log10(Pc) MAE",
        f"{model_regression['mae']:.3f}",
        f"{model_regression['mae'] - baseline_regression['mae']:+.3f} vs max_risk_estimate",
        delta_color="inverse",
    )
    metrics[4].metric("Critical precision", f"{critical_precision:.1%}", "False alarms still need review")

    if model_metrics["balanced_accuracy"] >= baseline_metrics["balanced_accuracy"]:
        st.markdown(
            f'<div class="success-note">The held-out event-tier model balanced accuracy is <b>{model_metrics["balanced_accuracy"]:.1%}</b> versus <b>{baseline_metrics["balanced_accuracy"]:.1%}</b> for the max-risk threshold baseline. This is measured on {result["validation_events"]:,} train events and does not establish operational performance.</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f'<div class="notice">The model does <b>not</b> beat the max-risk rule baseline on balanced accuracy ({model_metrics["balanced_accuracy"]:.1%} vs {baseline_metrics["balanced_accuracy"]:.1%}). It is not a demonstrated improvement; a duty operator should retain the deterministic baseline as a visible cross-check.</div>',
            unsafe_allow_html=True,
        )

    left, right = st.columns([1.12, 0.88], gap="large")
    with left:
        st.subheader("Tier performance · baseline vs model")
        chart_rows = []
        for system, system_metrics in (
            ("XGBoost classifier", model_metrics),
            ("max_risk_estimate rules", baseline_metrics),
        ):
            for tier in TIERS:
                report = system_metrics["per_class"][tier]
                chart_rows.append(
                    {
                        "System": system,
                        "Risk tier": tier.title(),
                        "Recall": report["recall"],
                        "Precision": report["precision"],
                    }
                )
        chart_data = pd.DataFrame(chart_rows)
        performance = px.bar(
            chart_data,
            x="Risk tier",
            y="Recall",
            color="System",
            barmode="group",
            color_discrete_sequence=["#61dbc0", "#8398ae"],
            text=chart_data["Recall"].map(lambda value: f"{value:.0%}"),
        )
        performance.update_traces(textposition="outside", cliponaxis=False)
        st.plotly_chart(
            _figure_theme(performance), width="stretch", key="validation-recall-chart"
        )
    with right:
        st.subheader("Model confusion · held-out events")
        matrix = np.asarray(model_metrics["confusion_matrix"], dtype=int)
        heat = go.Figure(
            data=go.Heatmap(
                z=matrix,
                x=[tier.title() for tier in TIERS],
                y=[tier.title() for tier in TIERS],
                colorscale=[[0, "#142338"], [0.55, "#216e70"], [1, "#70e3bf"]],
                text=matrix,
                texttemplate="%{text:,}",
                hovertemplate="Actual %{y}<br>Predicted %{x}<br>Events %{z}<extra></extra>",
                colorbar={"title": "Events"},
            )
        )
        heat.update_layout(
            xaxis_title="Predicted final tier",
            yaxis_title="Actual final tier",
            yaxis={"autorange": "reversed"},
        )
        st.plotly_chart(
            _figure_theme(heat), width="stretch", key="validation-confusion-matrix"
        )

    st.subheader("Regression benchmark · final log10(Pc)")
    regression_comparison = pd.DataFrame(
        [
            {
                "Predictor": "XGBoost regressor",
                "MAE (log10 Pc)": model_regression["mae"],
                "RMSE (log10 Pc)": model_regression["rmse"],
                "R²": model_regression["r2"],
            },
            {
                "Predictor": "max_risk_estimate baseline",
                "MAE (log10 Pc)": baseline_regression["mae"],
                "RMSE (log10 Pc)": baseline_regression["rmse"],
                "R²": baseline_regression["r2"],
            },
        ]
    )
    st.dataframe(
        regression_comparison.style.format(
            {"MAE (log10 Pc)": "{:.3f}", "RMSE (log10 Pc)": "{:.3f}", "R²": "{:.3f}"}
        ),
        hide_index=True,
        width="stretch",
    )
    st.caption(
        "A model that underperforms the current max-risk estimate is not an improvement. "
        "The regressor predicts log10(Pc); the classifier independently predicts final event tier. "
        "The `risk = −30` workbook placeholder represents Pc ≈ 0 and limits log-probability metrics."
    )

    st.subheader("Failure analysis · critical events missed")
    misses = result["critical_misses"]
    if misses.empty:
        st.markdown(
            '<div class="success-note">No held-out Critical events were classified as Safe/Elevated in this split. This does not imply zero future missed conjunctions.</div>',
            unsafe_allow_html=True,
        )
    else:
        final_close = int(misses["final_miss_distance_m"].lt(1_000).sum())
        early_wide = int(misses["miss_distance"].gt(5_000).sum())
        st.markdown(
            f'<div class="danger-note">The model missed <b>{len(misses)}</b> held-out Critical events. <b>{final_close}</b> ended with a final miss under 1 km; <b>{early_wide}</b> already had a ≥2-day input miss over 5 km. This shows the key failure mode: early geometry can differ materially from the final encounter. The table contrasts early and final distance; these false negatives require later CDMs / approved flight-dynamics review, not model confidence.</div>',
            unsafe_allow_html=True,
        )
        failure_table = misses[
            [
                EVENT_ID,
                "tier",
                "predicted_tier",
                "classifier_score",
                "time_to_tca",
                "miss_distance",
                "final_miss_distance_m",
                "risk",
                "predicted_risk_log10_pc",
            ]
        ].head(12)
        st.dataframe(
            failure_table.style.format(
                {
                    "classifier_score": "{:.1%}",
                    "time_to_tca": "{:.2f}",
                    "miss_distance": "{:,.0f}",
                    "final_miss_distance_m": "{:,.0f}",
                    "risk": "{:.2f}",
                    "predicted_risk_log10_pc": "{:.2f}",
                }
            ),
            hide_index=True,
            width="stretch",
        )

    st.caption(
        f"Eligible workbook labels: {labels_stats['eligible_label_events']:,}. "
        f"Matched to a ≥2-day CDM: {labels_stats['events_with_2d_cdm']:,}. "
        f"Unusable labels: {labels_stats['excluded_unusable_labels']:,}. "
        f"Label events without any ≥2-day CDM: {labels_stats['eligible_events_without_cdm']:,}. "
        "Validation contains no event IDs in common with the fit fold."
    )
    return result


def _render_warning_panel(
    test_predictions: pd.DataFrame, live_screening: pd.DataFrame | None
) -> None:
    st.header("24-hour conjunction watch")
    if live_screening is not None:
        source_name = "uploaded operational CDM snapshot"
        eligible_window = live_screening
        window_events = eligible_window.loc[
            eligible_window["screened_tier"].ne("safe")
        ].copy()
        critical_count = int(eligible_window["screened_tier"].eq("critical").sum())
        elevated_count = int(eligible_window["screened_tier"].eq("elevated").sum())
    else:
        source_name = "test dataset"
        window_events = warning_events(test_predictions, horizon_days=1)
        eligible_window = test_predictions.loc[
            test_predictions["time_to_tca"].ge(0)
            & test_predictions["time_to_tca"].le(1)
        ]
        critical_count = int(eligible_window["predicted_tier"].eq("critical").sum())
        elevated_count = int(eligible_window["predicted_tier"].eq("elevated").sum())

    c1, c2, c3 = st.columns(3)
    c1.metric("Conjunctions in 24 h", f"{len(eligible_window):,}")
    c2.metric("Predicted critical", f"{critical_count:,}")
    c3.metric("Predicted elevated", f"{elevated_count:,}")
    if eligible_window.empty:
        if live_screening is None:
            message = (
                "The supplied test CDMs are 2–7 days from TCA, so none qualify for "
                "a 24-hour watch. Nothing is fabricated or backdated. Upload an "
                "upcoming operational snapshot to populate this view."
            )
        else:
            message = (
                "No uploaded CDM rows fall within 0–24 hours. The watch does not "
                "backdate later events or fabricate a conjunction."
            )
        st.markdown(
            f'<div class="notice"><b>No 24-hour event can be verified from the current {source_name}.</b> {message}</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f'            <div class="success-note">Watch populated from the {source_name}. Events are within the next 24 hours, ordered by closest TCA. Uploaded current CDMs use deterministic thresholds; this is not an alert service or maneuver recommendation.</div>',
            unsafe_allow_html=True,
        )
    if window_events.empty:
        return
    if live_screening is not None:
        view = window_events[
            [
                EVENT_ID,
                "time_to_tca",
                "screened_tier",
                "screening_risk_source",
                "risk" if "risk" in window_events else "max_risk_estimate",
                "miss_distance",
                "relative_speed",
                "manual_review_required",
                "manual_review_reasons",
            ]
        ].rename(
            columns={
                EVENT_ID: "Event",
                "time_to_tca": "TCA · days",
                "screened_tier": "Current-CDM rule tier",
                "screening_risk_source": "Risk basis",
                "risk": "Current log10(Pc)",
                "max_risk_estimate": "Current max-risk estimate",
                "miss_distance": "Current miss · m",
                "relative_speed": "Relative speed · m/s",
                "manual_review_required": "Manual review",
                "manual_review_reasons": "Review flags",
            }
        )
        st.dataframe(
            view.style.format(
                {"TCA · days": "{:.3f}", "Current log10(Pc)": "{:.3f}",
                 "Current max-risk estimate": "{:.3f}", "Current miss · m": "{:,.0f}",
                 "Relative speed · m/s": "{:,.0f}"}
            ),
            hide_index=True,
            width="stretch",
        )
        st.caption(
            "Operational 24-hour rows use deterministic thresholds on current CDMs; "
            "the model is not extrapolated beyond its ≥2-day training window."
        )
    else:
        view = window_events[
            [
                EVENT_ID,
                "time_to_tca",
                "predicted_tier",
                "classifier_score",
                "predicted_risk_log10_pc",
                "baseline_tier",
                "miss_distance",
                "relative_speed",
                "manual_review_required",
            ]
        ].copy()
        view = view.rename(
            columns={
                EVENT_ID: "Event",
                "time_to_tca": "TCA · days",
                "predicted_tier": "Screening tier",
                "classifier_score": "Classifier score*",
                "predicted_risk_log10_pc": "Predicted final log10(Pc)",
                "baseline_tier": "Rule baseline",
                "miss_distance": "Observed miss · m",
                "relative_speed": "Relative speed · m/s",
                "manual_review_required": "Manual review",
            }
        )
        st.dataframe(
            view.style.format(
                {
                    "TCA · days": "{:.3f}",
                    "Classifier score*": "{:.1%}",
                    "Predicted final log10(Pc)": "{:.3f}",
                    "Observed miss · m": "{:,.0f}",
                    "Relative speed · m/s": "{:,.0f}",
                }
            ),
            hide_index=True,
            width="stretch",
        )
        st.caption("*Uncalibrated classifier score; not a calibrated probability of safety or collision.")


def _render_trajectory(
    source_events: pd.DataFrame, selected_event_id: str
) -> None:
    event_rows = source_events.loc[
        source_events[EVENT_ID].astype(str).eq(str(selected_event_id))
    ].copy()
    if event_rows.empty:
        st.info("No source CDMs are available for this event's trajectory.")
        return
    event_rows = event_rows.sort_values("time_to_tca", ascending=False)
    positions = ["relative_position_r", "relative_position_t", "relative_position_n"]
    if event_rows[positions].notna().all(axis=1).any():
        valid = event_rows.dropna(subset=positions).copy()
        valid["Days to TCA"] = valid["time_to_tca"]
        three_d = px.line_3d(
            valid,
            x="relative_position_r",
            y="relative_position_t",
            z="relative_position_n",
            hover_data={
                "time_to_tca": ":.3f",
                "miss_distance": ":,.0f",
            },
            markers=True,
            labels={
                "relative_position_r": "Radial · m",
                "relative_position_t": "Tangential · m",
                "relative_position_n": "Normal · m",
                "time_to_tca": "Days to TCA",
                "miss_distance": "Miss distance · m",
            },
            color_discrete_sequence=["#65ddc6"],
        )
        three_d.update_traces(line={"width": 4}, marker={"size": 4})
        _figure_theme(three_d)
        three_d.update_layout(scene={"bgcolor": "rgba(0,0,0,0)"})
        st.plotly_chart(
            three_d, width="stretch", key=f"relative-3d-{selected_event_id}"
        )

        projection = go.Figure()
        for coordinate, color, label in (
            ("relative_position_r", "#70dacc", "Radial · R"),
            ("relative_position_t", "#84a9ee", "Tangential · T"),
            ("relative_position_n", "#e7bb72", "Normal · N"),
        ):
            projection.add_trace(
                go.Scatter(
                    x=event_rows["time_to_tca"],
                    y=event_rows[coordinate],
                    mode="lines+markers",
                    name=label,
                    line={"color": color, "width": 2},
                    marker={"size": 5},
                )
            )
        projection.update_layout(
            xaxis_title="Time to closest approach · days",
            yaxis_title="Relative position · m",
            hovermode="x unified",
        )
        _figure_theme(projection)
        st.plotly_chart(
            projection, width="stretch", key=f"relative-components-{selected_event_id}"
        )

    if "miss_distance" in event_rows:
        distance = px.scatter(
            event_rows,
            x="time_to_tca",
            y="miss_distance",
            hover_data=[EVENT_ID, "relative_speed"],
            labels={
                "time_to_tca": "Time to closest approach · days",
                "miss_distance": "Observed miss distance · m",
            },
            color_discrete_sequence=["#71ddc7"],
        )
        distance.add_hline(y=1_000, line_dash="dot", line_color="#ff888d", annotation_text="1 km critical distance")
        distance.add_hline(y=5_000, line_dash="dot", line_color="#efc677", annotation_text="5 km screening band")
        _figure_theme(distance)
        distance.update_yaxes(type="log")
        st.plotly_chart(
            distance, width="stretch", key=f"miss-vs-tca-{selected_event_id}"
        )

    st.markdown("**Available positional-uncertainty inputs · 1σ in metres**")
    uncertainty_fields = [
        column for column in ("c_sigma_r", "t_sigma_r") if column in event_rows
    ]
    if uncertainty_fields:
        uncertainty = event_rows[["time_to_tca", *uncertainty_fields]].melt(
            id_vars="time_to_tca",
            var_name="Available source",
            value_name="Reported 1σ · m",
        )
        uncertainty = uncertainty.dropna(subset=["Reported 1σ · m"])
        if not uncertainty.empty:
            sigma_plot = px.line(
                uncertainty,
                x="time_to_tca",
                y="Reported 1σ · m",
                color="Available source",
                markers=True,
                color_discrete_sequence=["#80a9e8", "#dbbd79"],
                labels={
                    "time_to_tca": "Time to closest approach · days",
                    "Reported 1σ · m": "Reported radial 1σ · m",
                },
            )
            _figure_theme(sigma_plot)
            st.plotly_chart(
                sigma_plot,
                width="stretch",
                key=f"uncertainty-{selected_event_id}",
            )
        st.caption(
            "`c_sigma_r` and `t_sigma_r` are the supplied radial position uncertainties. "
            "The files do not provide full 3×3 covariance matrices, tangential/normal "
            "sigmas, or cross-covariance terms; no covariance ellipse or conjunction "
            "probability is synthesized from incomplete inputs."
        )
    else:
        st.warning(
            "No positional uncertainty columns were present. The source schema does not "
            "contain a full covariance matrix."
        )


def _render_decision_report(
    predictions: pd.DataFrame,
    provenance: dict[str, str],
    model_version: str,
) -> None:
    st.subheader("Operational decision record")
    candidates = predictions[EVENT_ID].astype(str).tolist()
    if not candidates:
        st.info("No events available for a decision-support report.")
        return
    selected = st.selectbox("Select a conjunction for review", candidates, key="report-event")
    event = predictions.loc[predictions[EVENT_ID].astype(str).eq(selected)].iloc[0]
    with st.form("decision-review"):
        reviewer = st.text_input("Reviewer / flight-dynamics officer")
        outcome = st.selectbox(
            "Human review outcome",
            [
                "Pending human review",
                "Reviewed · retain monitoring",
                "Reviewed · escalate to flight dynamics",
                "Reviewed · false alarm",
                "Reviewed · insufficient evidence",
            ],
        )
        notes = st.text_area("Review notes", height=90)
        submitted = st.form_submit_button("Generate decision record", type="primary")
    if submitted:
        report = build_decision_report(
            event,
            {
                "model_version": model_version,
                **provenance,
            },
            reviewer=reviewer,
            review_outcome=outcome,
            reviewer_notes=notes,
        )
        st.session_state["latest_decision_report"] = report
        logger.info(
            "Generated decision report %s for event %s; reviewer outcome: %s",
            report["report_id"],
            report["event_id"],
            outcome,
        )
    report = st.session_state.get("latest_decision_report")
    if report:
        st.markdown(
            f'<div class="notice"><b>Human authority required.</b> The generated record does not recommend, authorize, or execute a maneuver. Model scores are uncalibrated estimates, not collision guarantees.</div>',
            unsafe_allow_html=True,
        )
        report_json = _safe_download_json(report)
        report_markdown = report_as_markdown(report)
        c1, c2 = st.columns(2)
        c1.download_button(
            "Download traceable report · JSON",
            data=report_json,
            file_name=f"{report['report_id']}.json",
            mime="application/json",
            key="report-json",
        )
        c2.download_button(
            "Download traceable report · Markdown",
            data=report_markdown,
            file_name=f"{report['report_id']}.md",
            mime="text/markdown",
            key="report-markdown",
        )
        if st.button("Save report to local audit log", key="persist-report"):
            LOG_ROOT.mkdir(parents=True, exist_ok=True)
            with LOG_PATH.open("a", encoding="utf-8") as audit_file:
                audit_file.write(report_json.replace("\n", "") + "\n")
            st.success(f"Saved locally to `{LOG_PATH}`.")


def _render_predictions(
    predictions: pd.DataFrame,
    source_cdms: pd.DataFrame,
    provenance: dict[str, str],
    model_version: str,
    filters: dict[str, Any],
) -> None:
    st.header("Unlabeled test events · final outcomes withheld")
    st.caption(
        "The supplied test split has no final event outcomes. Displayed model predictions "
        "are not accuracy metrics. Event IDs restart per file; they are never joined across splits."
    )
    selected_tiers = filters["selected_tiers"]
    maximum_distance = int(filters["minimum_distance"])
    maximum_tca = float(filters["maximum_tca"])
    displayed = predictions.loc[
        predictions["predicted_tier"].isin(selected_tiers)
        & predictions["miss_distance"].le(maximum_distance)
        & predictions["time_to_tca"].le(maximum_tca)
    ].copy()
    if displayed.empty:
        st.info("No test events match the current tier, distance, and TCA filters.")
        return
    st.caption(f"Showing {len(displayed):,} of {len(predictions):,} test events.")

    left, right = st.columns([1.25, 0.75], gap="large")
    with left:
        st.subheader("Final-tier predictions")
        display_columns = [
            EVENT_ID,
            "time_to_tca",
            "miss_distance",
            "predicted_tier",
            "ml_predicted_tier",
            "classifier_score",
            "predicted_risk_log10_pc",
            "baseline_risk_log10_pc",
            "baseline_tier",
            "manual_review_required",
            "manual_review_reasons",
        ]
        table = displayed.loc[:, display_columns].rename(
            columns={
                EVENT_ID: "Event",
                "time_to_tca": "TCA · days",
                "miss_distance": "Miss · m",
                "predicted_tier": "Final tier",
                "ml_predicted_tier": "ML tier",
                "classifier_score": "Score*",
                "predicted_risk_log10_pc": "Predicted final log10(Pc)",
                "baseline_risk_log10_pc": "max_risk_estimate",
                "baseline_tier": "Baseline tier",
                "manual_review_required": "Manual review",
                "manual_review_reasons": "Review flags",
            }
        )
        st.dataframe(
            table.style.format(
                {
                    "TCA · days": "{:.2f}",
                    "Miss · m": "{:,.0f}",
                    "Score*": "{:.1%}",
                    "Predicted final log10(Pc)": "{:.3f}",
                    "max_risk_estimate": "{:.3f}",
                }
            ),
            hide_index=True,
            width="stretch",
            height=460,
        )
    with right:
        st.subheader("Prediction mix")
        counts = displayed["predicted_tier"].value_counts().reindex(TIERS, fill_value=0)
        pie = go.Figure(
            go.Pie(
                labels=[tier.title() for tier in TIERS],
                values=counts.values,
                hole=0.7,
                marker={"colors": ["#5cd7ae", "#edc16e", "#f27782"]},
                textinfo="label+value",
            )
        )
        pie.add_annotation(
            text=f"{len(displayed):,}<br>events",
            x=0.5,
            y=0.5,
            showarrow=False,
            font={"size": 19, "color": "#edf4fa"},
        )
        _figure_theme(pie)
        st.plotly_chart(pie, width="stretch", key="test-prediction-mix")
        manual_review = int(displayed["manual_review_required"].sum())
        fallback_count = int(displayed["fallback_used"].sum())
        st.metric("Manual-review flags", f"{manual_review:,}", f"{manual_review / len(displayed):.1%} of shown events")
        st.metric("Rule fallback used", f"{fallback_count:,}", "Low confidence / incomplete evidence")
    st.caption(
        "*Classifier score is uncalibrated and must not be interpreted as a verified "
        "collision probability. The plotted predicted Pc comes from a distinct regression model."
    )

    focused_event = str(
        st.selectbox(
            "Explore CDM trajectory and positional uncertainty",
            displayed[EVENT_ID].astype(str).tolist(),
            key="trajectory-event",
        )
    )
    _render_trajectory(source_cdms, focused_event)

    st.subheader("Download prediction audit")
    csv_bytes = displayed.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download predictions with review flags · CSV",
        data=csv_bytes,
        file_name="test-event-prediction-audit.csv",
        mime="text/csv",
        key="test-audit-download",
    )
    if st.button("Save prediction log locally", key="persist-predictions"):
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
        log_columns = [
            EVENT_ID,
            "time_to_tca",
            "predicted_risk_log10_pc",
            "ml_predicted_tier",
            "predicted_tier",
            "classifier_score",
            "probability_safe",
            "probability_elevated",
            "probability_critical",
            "baseline_risk_log10_pc",
            "baseline_tier",
            "fallback_used",
            "manual_review_required",
            "manual_review_reasons",
        ]
        saved = displayed.loc[:, log_columns].copy()
        saved.insert(0, "timestamp_utc", datetime.now(timezone.utc).isoformat())
        saved.insert(1, "model_version", model_version)
        saved.insert(2, "input_provenance_json", json.dumps(provenance, sort_keys=True))
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as audit_file:
            for record in saved.to_dict(orient="records"):
                audit_file.write(
                    json.dumps(record, default=_json_default, allow_nan=False) + "\n"
                )
        st.success(f"Appended {len(saved):,} traceable outputs to `{LOG_PATH}`.")

    _render_decision_report(displayed, provenance, model_version)


def _render_scope_and_policy() -> None:
    with st.expander("Risk rules, units, and evidence boundaries", expanded=False):
        st.markdown(
            """
            | Tier | Deterministic threshold |
            |---|---|
            | **Critical** | `risk ≥ −4` **or** miss distance `< 1,000 m` |
            | **Elevated** | otherwise, `risk ≥ −6` **or** miss distance `≤ 5,000 m` |
            | **Safe** | `risk < −6` **and** miss distance `> 5,000 m` |

            **Risk is log₁₀(Pc).** A `risk = −30` value is the challenge-defined near-zero-Pc placeholder.
            Distance / relative positions / `c_sigma_r` / `t_sigma_r` are in metres;
            relative speed is m/s; `time_to_tca` is in days. The two-day pre-TCA cutoff
            and the ≤1-day warning horizon are separate.

            `event_id` is retained only for train-label joins and event-grouped validation;
            it is never passed into a model or used to join test events.
            Missing numeric inputs are median-imputed and reported as manual-review flags.
            Low-confidence classification, a baseline/model tier disagreement, a ≤5 km
            approach, or a ≤24-hour TCA also requests review. Classifier scores are not calibrated.

            **No full relative covariance matrices are present in the supplied CSV.**
            The UI visualizes the available radial standard-deviation columns only and does
            not infer cross-covariance, conjunction probability, orbit state, or an actionable
            maneuver. NASA / ESA guidance is not substituted for an approved mission policy;
            this prototype applies the exact challenge thresholds and cites the challenge brief.
            """
        )
        st.code(
            "Allowed model fields: "
            + ", ".join(column for column in ALLOWED_COLUMNS if column != EVENT_ID),
            language="text",
        )


def main() -> None:
    _render_header()
    train_upload, label_upload, test_upload, options = _render_sidebar()
    _render_scope_and_policy()
    try:
        train_source, train_descriptor = _load_source(
            "training CDM", train_upload, options["train_path"]
        )
        labels_source, labels_descriptor = _load_source(
            "event-label", label_upload, options["label_path"]
        )
        test_source, test_descriptor = _load_source(
            "unlabeled test CDM", test_upload, options["test_path"]
        )
        provenance = {
            "train_file": train_descriptor,
            "train_sha256": _sha256(train_source),
            "labels_file": labels_descriptor,
            "labels_sha256": _sha256(labels_source),
            "test_file": test_descriptor,
            "test_sha256": _sha256(test_source),
            "feature_allowlist": list(ALLOWED_COLUMNS),
            "event_join_policy": "Join labels to train split only; IDs restart per file.",
            "split_policy": "Deterministic stratified 80/20 holdout grouped by event_id; seed 42.",
        }
        train_events, labels_stats = _cached_training_events(
            train_source, labels_source
        )
        model_key = provenance["train_sha256"] + provenance["labels_sha256"]
        models = _cached_models(train_events, model_key)
        test_cdm = load_cdm_data(test_source)
        test_events, test_all_cdms = prepare_test_events(test_cdm)
        test_predictions = predict_events(models, test_events)

        live_screening = None
        live_upload = options["live_upload"]
        if live_upload is not None:
            live_cdm = load_cdm_data(live_upload)
            live_screening = screen_current_cdms(live_cdm)
            provenance["live_snapshot_sha256"] = _sha256(live_upload)

        test_window = warning_events(test_predictions)
        metrics = st.columns(4)
        metrics[0].metric(
            "Eligible event labels",
            f"{labels_stats['eligible_label_events']:,}",
            "Workbook · train split only",
        )
        metrics[1].metric(
            "Matched ≥2-day events",
            f"{len(train_events):,}",
            f"{labels_stats['eligible_events_without_cdm']:,} eligible labels without CDMs",
        )
        metrics[2].metric(
            "Test events predicted",
            f"{len(test_predictions):,}",
            "No final outcomes available",
        )
        metrics[3].metric(
            "Test-set 24-hour warnings",
            f"{len(test_window):,}",
            "Challenge test starts 2–7 days out",
        )
        st.markdown(
            '<div class="notice">This challenge test split contains no 24-hour events or final labels. A zero 24-hour count is the correct data-grounded result—not a claim of zero operational risk. Upload an upcoming CDM snapshot to populate the warning watch.</div>',
            unsafe_allow_html=True,
        )

        provenance_tab, warning_tab, validation_tab, prediction_tab = st.tabs(
            [
                "◈  Source & readiness",
                "◷  24-hour watch",
                "⌁  Model validation",
                "↗  Event predictions",
            ]
        )
        with provenance_tab:
            st.subheader("The data, split, and final-event target")
            dataset_rows = [
                {
                    "Source": "Training CDMs",
                    "Rows": len(load_cdm_data(train_source)),
                    "SHA-256": provenance["train_sha256"],
                    "Use": "Eligible ≥2-day messages for model fit",
                },
                {
                    "Source": "Event-label workbook export",
                    "Rows": labels_stats["eligible_label_events"],
                    "SHA-256": provenance["labels_sha256"],
                    "Use": "One final event outcome per train event",
                },
                {
                    "Source": "Unlabeled test CDMs",
                    "Rows": len(test_cdm),
                    "SHA-256": provenance["test_sha256"],
                    "Use": "Predictions only; never used for fit or scoring",
                },
            ]
            st.dataframe(pd.DataFrame(dataset_rows), hide_index=True, width="stretch")
            st.markdown(
                f"""
                <div class="success-note">
                <b>Leakage controls in force.</b> The dataset contributes
                <b>{len(train_events):,} eligible train events</b> and
                <b>{len(test_events):,} separately identified test events</b>.
                The event classifier sees each event’s latest CDM at ≥2 days to TCA;
                <code>event_id</code> is only a train-side group/join key, not a feature.
                Test event IDs are kept in a separate namespace and their (non-final)
                <code>risk</code> values are not attached to final label records.
                </div>
                """,
                unsafe_allow_html=True,
            )
            with st.expander("Show exact model feature allowlist"):
                st.code(", ".join(ALLOWED_COLUMNS), language="text")
            st.markdown(
                f"**Deterministic training-label tier distribution:** "
                + " · ".join(
                    f"{tier.title()} **{count:,}**"
                    for tier, count in models["training_tier_counts"].items()
                )
            )
            st.caption(
                f"Labels ineligible under the workbook: {labels_stats['excluded_unusable_labels']:,}. "
                f"Eligible labels without any qualifying CDM: {labels_stats['eligible_events_without_cdm']:,}. "
                "All model fitting, charts, and file parsing run locally in this process."
            )
            with st.expander("View underlying train and test CDMs"):
                selected_split = st.radio(
                    "Dataset", ["Training (allowed fields)", "Test (allowed fields)"], horizontal=True
                )
                chosen = load_cdm_data(train_source if selected_split.startswith("Training") else test_source)
                st.dataframe(chosen.head(60), hide_index=True, width="stretch")

        with warning_tab:
            _render_warning_panel(test_predictions, live_screening)
            if live_upload is not None:
                st.caption(
                    "The live watch is screened message-by-message on current CDM risk / "
                    "miss distance. The final-tier ML model stays within its ≥2-day "
                    "training window."
                )

        with validation_tab:
            with st.spinner("Scoring grouped holdout and deterministic baseline…"):
                validation = _evaluate_and_render(train_events, labels_stats, provenance)
            export_records = {
                "evaluation": {
                    key: value
                    for key, value in validation.items()
                    if key not in {"validation_rows", "critical_misses", "failures"}
                },
                "provenance": provenance,
                "model_version": models["version"],
                "cutoff_rules": {
                    "validation_holdout": "20% of unique eligible train events",
                    "group_key": "event_id",
                    "random_seed": 42,
                },
            }
            st.download_button(
                "Download validation metrics · JSON",
                data=_safe_download_json(export_records),
                file_name="challenge1-event-validation.json",
                mime="application/json",
                key="validation-json-download",
            )

        with prediction_tab:
            _render_predictions(
                test_predictions,
                test_all_cdms,
                provenance,
                models["version"],
                {
                    "selected_tiers": options["selected_tiers"],
                    "minimum_distance": int(options["minimum_distance"]),
                    "maximum_tca": float(options["maximum_tca"]),
                },
            )

        st.divider()
        st.markdown(
            f"<div class='small-note'>Model <span class='mono'>{models['version']}</span> · "
            f"deterministic seed 42 · local-only processing · "
            f"{len(test_predictions):,} test-event outputs · Challenge 1 criteria, updated 31 Oct 2026.</div>",
            unsafe_allow_html=True,
        )
    except (OSError, UnicodeError, ValueError, TypeError) as error:
        logger.exception("Could not load and evaluate the selected Challenge 1 datasets.")
        st.error(f"Cannot prepare the collision-avoidance workflow: {error}")
        st.info(
            "Select the supplied training CSV, event-label CSV exported from the workbook, "
            "and the unlabeled test CSV. The app does not fetch files or fill missing datasets "
            "with synthetic examples."
        )


if __name__ == "__main__":
    main()
