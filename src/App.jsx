import { useMemo, useState } from "react";
import datasetSummary from "./data/dataset-summary.json";
import { classifyCollisionRisk } from "./riskPolicy.js";
import { riskTestCases } from "./riskTestCases.js";

const events = [
  {
    id: "CDM-4821",
    time: "13:42:18 UTC",
    date: "Today · 31 Oct",
    object: "STARLINK-31201",
    secondary: "COSMOS 2251 DEB",
    altitude: "548.2 km",
    probability: "1 : 820",
    risk: "high",
    miss: "184 m",
    conjunction: "In 02h 18m",
    orbit: "LEO · 53.2° inclination",
  },
  {
    id: "CDM-4817",
    time: "16:08:42 UTC",
    date: "Today · 31 Oct",
    object: "ICEYE-X27",
    secondary: "SL-8 R/B",
    altitude: "612.7 km",
    probability: "1 : 4,200",
    risk: "medium",
    miss: "426 m",
    conjunction: "In 04h 44m",
    orbit: "LEO · 97.8° inclination",
  },
  {
    id: "CDM-4802",
    time: "21:35:06 UTC",
    date: "Today · 31 Oct",
    object: "SENTINEL-2B",
    secondary: "OBJECT 49812",
    altitude: "786.4 km",
    probability: "1 : 28,600",
    risk: "low",
    miss: "1.24 km",
    conjunction: "In 10h 11m",
    orbit: "SSO · 98.6° inclination",
  },
];

const navigation = [
  { label: "Overview", icon: "grid", href: "#overview" },
  { label: "Risk evaluator", icon: "crosshair", href: "#evaluator" },
  { label: "AI validation", icon: "chart", href: "#model" },
  { label: "Dataset analysis", icon: "chart", href: "#datasets" },
  { label: "Conjunctions", icon: "orbit", href: "#conjunctions", count: "12" },
  { label: "Fleet health", icon: "satellite", href: "#fleet" },
  { label: "Analytics", icon: "chart", href: "#analytics" },
];

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    orbit: <><circle cx="12" cy="12" r="2.3" /><ellipse cx="12" cy="12" rx="9" ry="4.3" transform="rotate(-35 12 12)" /><path d="m18.7 5.2 1.1-.1-.1 1.1" /></>,
    satellite: <><path d="m10.5 13.5 3-3M8 16l-3 3m11-11 3-3M7 8l9 9" /><path d="m5 5 3 3-3 3-3-3 3-3Zm14 11 3 3-3 3-3-3 3-3Z" /><rect x="9" y="9" width="6" height="6" rx="1.2" transform="rotate(-45 12 12)" /></>,
    chart: <><path d="M4 19.5h16M6.5 16v-4m5 4V6m5 10V9" /><path d="m5 8 5-4 5 2 4-3" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    crosshair: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v4h14v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  };
  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function Brand() {
  return (
    <a className="brand" href="#overview" aria-label="Orbital home">
      <span className="brand-icon"><Icon name="orbit" size={20} /></span>
      <span>orbital<span className="brand-period">.</span></span>
    </a>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-switcher">
        <div className="workspace-avatar">N</div>
        <div className="workspace-copy"><strong>Nanyang Space Programme</strong><span>Mission control</span></div>
        <span className="workspace-caret">⌄</span>
      </div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map((item, index) => (
          <a className={`side-link ${index === 0 ? "active" : ""}`} href={item.href} key={item.label}>
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
            {item.count && <span className="nav-count">{item.count}</span>}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-card">
          <span className="connection-icon"><Icon name="crosshair" size={17} /></span>
          <div><strong>Demo environment</strong><span>Sample data · not live</span></div>
          <span className="online-dot" />
        </div>
        <button className="profile-button" type="button">
          <span className="profile-avatar">AM</span>
          <span className="profile-copy"><strong>Alex Morgan</strong><small>Flight dynamics</small></span>
          <span className="profile-menu">•••</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({ query, onQueryChange }) {
  return (
    <div className="topbar">
      <div className="breadcrumbs"><span>Mission control</span><Icon name="chevron" size={14} /><strong>Overview</strong></div>
      <div className="topbar-actions">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input aria-label="Search satellites or events" placeholder="Search satellites, events..." value={query} onChange={(event) => onQueryChange(event.target.value)} />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Icon name="bell" size={18} /><span className="notification-dot" />
        </button>
        <button className="help-button" type="button" aria-label="Help and support">?</button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, tone, trend }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}><Icon name={icon} size={17} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{trend && <span className={`metric-trend ${tone}`}>{trend}</span>}{detail}</div>
    </article>
  );
}

function OrbitMap({ selectedEvent }) {
  return (
    <div className="orbit-map">
      <div className="map-topline">
        <div className="map-coordinates"><span className="demo-dot" /> SIMULATED ORBITAL VIEW <span className="coordinates-divider">/</span> 53.2° N · 12.4° E</div>
        <button className="map-control" type="button" aria-label="Expand orbital view"><span>⤢</span></button>
      </div>
      <svg className="orbit-graphic" viewBox="0 0 680 340" role="img" aria-label={`Orbital path visualization for ${selectedEvent.object} and nearby objects`}>
        <defs>
          <radialGradient id="earthFill" cx="38%" cy="28%" r="74%">
            <stop offset="0%" stopColor="#214b68" />
            <stop offset="60%" stopColor="#122d46" />
            <stop offset="100%" stopColor="#0d1d32" />
          </radialGradient>
          <radialGradient id="earthGlow">
            <stop offset="0%" stopColor="#3aa9b4" stopOpacity=".14" />
            <stop offset="100%" stopColor="#3aa9b4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="collisionPath" x1="0" x2="1">
            <stop offset="0%" stopColor="#55d6c2" stopOpacity=".08" />
            <stop offset="55%" stopColor="#55d6c2" stopOpacity=".9" />
            <stop offset="100%" stopColor="#ff866c" stopOpacity=".95" />
          </linearGradient>
          <clipPath id="earthClip"><circle cx="340" cy="194" r="87" /></clipPath>
        </defs>
        <circle cx="340" cy="194" r="148" fill="url(#earthGlow)" />
        <g className="map-stars" fill="#b9d1df">
          <circle cx="62" cy="64" r="1.2" /><circle cx="131" cy="123" r="1" /><circle cx="203" cy="48" r="1.2" />
          <circle cx="551" cy="60" r="1.3" /><circle cx="616" cy="128" r="1" /><circle cx="585" cy="260" r="1.1" />
          <circle cx="114" cy="268" r="1.2" /><circle cx="470" cy="292" r="1" /><circle cx="518" cy="162" r="1.1" />
          <circle cx="246" cy="304" r="1" /><circle cx="420" cy="51" r="1" /><circle cx="72" cy="197" r="1" />
        </g>
        <ellipse className="orbit-track orbit-track-a" cx="340" cy="194" rx="244" ry="74" transform="rotate(-17 340 194)" />
        <ellipse className="orbit-track orbit-track-b" cx="340" cy="194" rx="214" ry="112" transform="rotate(35 340 194)" />
        <ellipse className="orbit-track orbit-track-c" cx="340" cy="194" rx="275" ry="129" transform="rotate(-42 340 194)" />
        <circle cx="340" cy="194" r="87" fill="url(#earthFill)" stroke="#4d8190" strokeOpacity=".42" />
        <g clipPath="url(#earthClip)" className="earth-land">
          <path d="M276 130 300 119 319 125 326 140 319 150 328 165 313 171 303 188 284 184 271 169 257 167 254 151Z" />
          <path d="m330 187 15-10 15 7 9 15-8 16 5 19-13 22-13-7-2-25-13-15Z" />
          <path d="m363 125 20-8 19 10 5 16-11 12-18-5-13 8-14-11Z" />
          <path d="m405 166 20-10 20 9 10 16-7 12-17-2-9 12-14-8Z" />
          <path d="m244 211 22-7 19 10 5 14-13 10-25-2-12-11Z" />
        </g>
        <path className="orbit-path" d="M92 123 C190 35 405 44 578 176" />
        <path className="orbit-path orbit-path-alt" d="M107 277 C200 319 442 287 581 96" />
        <path className="conjunction-path" d="M141 101 C225 68 331 74 407 123 C462 157 503 190 535 228" />
        <circle className="path-point" cx="407" cy="123" r="7" />
        <circle className="path-point-halo" cx="407" cy="123" r="15" />
        <g className="sat-marker selected-marker" transform="translate(407 123)">
          <rect x="-7" y="-7" width="14" height="14" rx="3" transform="rotate(45)" />
          <circle cx="0" cy="0" r="2" fill="#eafffb" />
        </g>
        <g className="sat-marker muted-marker" transform="translate(535 228)">
          <rect x="-6" y="-6" width="12" height="12" rx="3" transform="rotate(45)" />
        </g>
        <g className="sat-marker teal-marker" transform="translate(174 262)">
          <rect x="-5" y="-5" width="10" height="10" rx="2.5" transform="rotate(45)" />
        </g>
        <text className="map-label" x="420" y="109">{selectedEvent.object}</text>
        <text className="map-label map-label-muted" x="545" y="230">{selectedEvent.secondary}</text>
        <text className="map-earth-label" x="340" y="299" textAnchor="middle">EARTH · LOW ORBIT</text>
        <g className="closest-approach" transform="translate(407 123)">
          <circle r="23" />
          <path d="M-31 0h62M0-31v62" />
        </g>
      </svg>
      <div className="map-legend">
        <span><i className="legend-dot legend-sat" /> Active satellite</span>
        <span><i className="legend-dot legend-debris" /> Tracked debris</span>
        <span><i className="legend-line" /> Predicted trajectory</span>
        <button type="button" className="map-layer">Layers <span>⌄</span></button>
      </div>
    </div>
  );
}

function RiskSummary({ event, onSchedule, scheduled }) {
  return (
    <aside className="risk-panel">
      <div className="risk-panel-heading">
        <div><span className="panel-eyebrow">SIMULATED CLOSEST APPROACH</span><span className="risk-badge"><i /> {event.risk} risk</span></div>
        <button type="button" className="dots-button" aria-label="More conjunction options">•••</button>
      </div>
      <div className="countdown">{event.conjunction.replace("In ", "")}</div>
      <div className="countdown-caption">UNTIL CONJUNCTION</div>
      <div className="risk-divider" />
      <div className="risk-facts">
        <div><span>Collision probability</span><strong className="probability-value">{event.probability}</strong></div>
        <div><span>Predicted miss distance</span><strong>{event.miss}</strong></div>
        <div><span>Orbital altitude</span><strong>{event.altitude}</strong></div>
        <div><span>Conjunction ID</span><strong className="id-value">{event.id}</strong></div>
      </div>
      <button className={`maneuver-button ${scheduled ? "scheduled" : ""}`} type="button" onClick={onSchedule}>
        {scheduled ? <><Icon name="shield" size={16} /> Maneuver scheduled</> : <><Icon name="crosshair" size={16} /> Plan avoidance maneuver</>}
      </button>
      <button className="analysis-link" type="button" onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}>
        View AI risk analysis <Icon name="arrow" size={14} />
      </button>
    </aside>
  );
}

function Conjunctions({ selectedEvent, onSelect, searchTerm }) {
  const [filter, setFilter] = useState("All events");
  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesSearch = `${event.id} ${event.object} ${event.secondary}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "All events" || event.risk === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  }), [filter, searchTerm]);

  return (
    <section className="conjunction-section" id="conjunctions">
      <div className="section-heading">
        <div><span className="panel-eyebrow">DEMO DATA · NOT FROM CSV</span><h2>Example conjunctions <span className="heading-count">12</span></h2></div>
        <button className="view-all-button" type="button" onClick={() => setFilter(filter === "All events" ? "High" : "All events")}>
          {filter === "All events" ? "View all events" : "Show all"} <Icon name="arrow" size={14} />
        </button>
      </div>
      <div className="event-filters" role="group" aria-label="Filter conjunctions">
        {["All events", "High", "Medium", "Low"].map((item) => (
          <button type="button" key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>
            {item !== "All events" && <i className={`filter-dot ${item.toLowerCase()}`} />}{item}
          </button>
        ))}
      </div>
      <div className="event-list">
        {visibleEvents.length ? visibleEvents.map((event) => (
          <button type="button" className={`event-row ${selectedEvent.id === event.id ? "event-selected" : ""}`} key={event.id} onClick={() => onSelect(event)}>
            <span className={`event-risk-indicator ${event.risk}`} />
            <span className="event-main">
              <span className="event-identifiers"><strong>{event.object}</strong><span>×</span><span>{event.secondary}</span></span>
              <span className="event-meta">{event.id}<i />{event.time}</span>
            </span>
            <span className="event-right">
              <span className={`event-risk-label ${event.risk}`}>{event.risk}</span>
              <strong>{event.conjunction.replace("In ", "")}</strong>
            </span>
            <Icon name="chevron" size={15} />
          </button>
        )) : <div className="empty-events">No conjunctions match your search.</div>}
      </div>
    </section>
  );
}

function FleetHealth() {
  const fleet = [
    { name: "STARLINK-31201", id: "NORAD 56218", orbit: "LEO · 548 km", status: "Monitoring", battery: "96%" },
    { name: "ICEYE-X27", id: "NORAD 58941", orbit: "LEO · 613 km", status: "Nominal", battery: "88%" },
    { name: "SENTINEL-2B", id: "NORAD 42063", orbit: "SSO · 786 km", status: "Nominal", battery: "92%" },
  ];
  return (
    <section className="fleet-section" id="fleet">
      <div className="section-heading">
        <div><span className="panel-eyebrow">DEMO SPACECRAFT · NOT FROM CSV</span><h2>Example fleet health</h2></div>
        <a className="view-all-button" href="#overview">View fleet <Icon name="arrow" size={14} /></a>
      </div>
      <div className="fleet-table-wrap">
        <table className="fleet-table">
          <thead><tr><th>SPACECRAFT</th><th>ORBIT</th><th>STATUS</th><th>POWER</th><th /></tr></thead>
          <tbody>{fleet.map((craft) => (
            <tr key={craft.name}>
              <td><span className="table-sat-icon"><Icon name="satellite" size={16} /></span><span><strong>{craft.name}</strong><small>{craft.id}</small></span></td>
              <td>{craft.orbit}</td>
              <td><span className={`spacecraft-status ${craft.status === "Monitoring" ? "monitoring" : ""}`}><i />{craft.status}</span></td>
              <td><span className="battery-value">{craft.battery}</span></td>
              <td><button className="row-more" aria-label={`More details for ${craft.name}`} type="button">•••</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function formatRaw(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
    : "—";
}

function DatasetAnalytics() {
  const [selectedSplit, setSelectedSplit] = useState("train");
  const dataset = datasetSummary.splits[selectedSplit];
  const riskStats = dataset.stats.risk;
  const previewRows = selectedSplit === "test"
    ? dataset.topPredictions.map((record) => ({
        row: record.row,
        eventId: record.eventId,
        predictedRisk: record.predictedRisk,
        actualRisk: record.actualRisk,
        predictedPc: record.predictedPc,
        missDistance: record.missDistanceMeters,
        relativeSpeed: record.relativeSpeed,
        predictedTier: record.predictedTier,
      }))
    : dataset.topRiskObservations.map((record) => ({
        row: record.row,
        eventId: record.eventId,
        predictedRisk: null,
        actualRisk: record.risk,
        predictedPc: 10 ** record.risk,
        missDistance: record.missDistance,
        relativeSpeed: record.relativeSpeed,
        predictedTier: classifyCollisionRisk(
          10 ** record.risk,
          record.missDistance / 1000,
        ),
      }));
  const maxBinCount = Math.max(...dataset.riskHistogram.map((bin) => bin.count));
  const chartWidth = 680;
  const chartHeight = 210;
  const plotTop = 24;
  const plotBottom = 164;
  const plotHeight = plotBottom - plotTop;
  const binWidth = 49;

  return (
    <section className="dataset-section" id="datasets">
      <div className="section-heading">
        <div><span className="panel-eyebrow">SUPPLIED CSV DATA · SUMMARY STATISTICS</span><h2>Training &amp; test data</h2></div>
        <span className="dataset-source-note">Raw CSV files stay on your machine</span>
      </div>
      <div className="dataset-panel">
        <div className="dataset-panel-heading">
          <div className="dataset-split-tabs" role="group" aria-label="Select dataset split">
            {["train", "test"].map((split) => (
              <button
                type="button"
                key={split}
                className={selectedSplit === split ? "selected" : ""}
                aria-pressed={selectedSplit === split}
                onClick={() => setSelectedSplit(split)}
              >
                {split === "train" ? "Training" : "Test"}
                <span>{datasetSummary.splits[split].rows.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <div className="dataset-file">{dataset.fileName} <span>·</span> {dataset.columns} columns</div>
        </div>

        <div className="dataset-facts">
          <article><span>Records</span><strong>{dataset.rows.toLocaleString()}</strong><small>CSV data rows</small></article>
          <article><span>Unique conjunctions</span><strong>{dataset.uniqueConjunctions.toLocaleString()}</strong><small>Grouped by event ID</small></article>
          <article><span>Allowed model inputs</span><strong>{dataset.featureColumns}</strong><small>Project-approved CSV features</small></article>
          <article><span>Risk target coverage</span><strong>{((dataset.target.labeledRows / dataset.rows) * 100).toFixed(1)}%</strong><small>{dataset.target.missingRows.toLocaleString()} missing labels</small></article>
        </div>

        <div className="tier-summary">
          <div className="tier-summary-heading"><span>Rule-based labels</span><small>Telemetry rows · not unique events</small></div>
          {["safe", "elevated", "critical"].map((tier) => (
            <div className={`tier-summary-item ${tier}`} key={tier}>
              <span><i />{tier}</span>
              <strong>{dataset.actualTierCounts[tier].toLocaleString()}</strong>
              <small>{((dataset.actualTierCounts[tier] / dataset.rows) * 100).toFixed(1)}%</small>
            </div>
          ))}
        </div>

        <div className="dataset-detail-grid">
          <article className="dataset-chart-card">
            <div className="dataset-card-heading">
              <div><h3>Risk target distribution</h3><span>Raw <code>risk</code> values · shared scale for both splits</span></div>
              <span className="raw-data-tag">RAW VALUES</span>
            </div>
            <div className="histogram-wrap">
              <svg className="risk-histogram" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Distribution of risk target values in ${dataset.fileName}`}>
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const y = plotBottom - fraction * plotHeight;
                  return <g className="histogram-grid" key={fraction}><line x1="40" y1={y} x2="660" y2={y} /><text x="34" y={y + 3} textAnchor="end">{formatRaw(maxBinCount * fraction)}</text></g>;
                })}
                <line className="histogram-axis" x1="40" y1={plotTop} x2="40" y2={plotBottom} />
                <line className="histogram-axis" x1="40" y1={plotBottom} x2="660" y2={plotBottom} />
                {dataset.riskHistogram.map((bin, index) => {
                  const height = maxBinCount ? (bin.count / maxBinCount) * (plotHeight - 4) : 0;
                  const x = 49 + index * binWidth;
                  return <g key={index}><title>{`${formatRaw(bin.from)} to ${formatRaw(bin.to)}: ${bin.count.toLocaleString()} rows`}</title><rect className="histogram-bar" x={x} y={plotBottom - height} width="30" height={height} rx="3" /></g>;
                })}
                <text className="histogram-endpoint" x="48" y="188">{formatRaw(datasetSummary.riskAxis.min)}</text>
                <text className="histogram-endpoint" x="660" y="188" textAnchor="end">{formatRaw(datasetSummary.riskAxis.max)}</text>
              </svg>
            </div>
            <div className="dataset-stat-line">
              <span><i className="stat-marker min" />Min <strong>{formatRaw(riskStats.min)}</strong></span>
              <span><i className="stat-marker mean" />Mean <strong>{formatRaw(riskStats.mean)}</strong></span>
              <span><i className="stat-marker max" />Max <strong>{formatRaw(riskStats.max)}</strong></span>
            </div>
          </article>

          <article className="dataset-rows-card">
            <div className="dataset-card-heading">
              <div><h3>{selectedSplit === "test" ? "Held-out test predictions" : "Highest-risk training observations"}</h3><span>{selectedSplit === "test" ? "One highest model estimate per event" : "Observed training labels; not model predictions"}</span></div>
              <span className="rows-count">8 rows</span>
            </div>
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead><tr><th>EVENT / ROW</th><th>MODEL CLASS</th><th>PRED. Pc</th><th>TRUE log10(Pc)</th><th>MISS (KM)</th></tr></thead>
                <tbody>{previewRows.map((record) => (
                  <tr key={record.row}>
                    <td>{record.eventId}<small>Row {record.row.toLocaleString()}</small></td>
                    <td><span className={`table-tier ${record.predictedTier}`}>{selectedSplit === "test" ? record.predictedTier : "Observed"}</span></td>
                    <td>{record.predictedRisk === null ? "—" : formatProbability(record.predictedPc)}</td>
                    <td className="target-value">{formatRaw(record.actualRisk)}</td>
                    <td>{formatRaw(record.missDistance / 1000)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="dataset-footnote">
          <Icon name="shield" size={15} />
          <p>Model estimates are trained on the training split only; Pc is calculated as <code>10 ** predicted risk</code> and clipped to the training target range. Test metrics use labeled held-out CSV rows. They are experimental, row-level estimates, not collision guarantees or maneuver advice.</p>
        </div>
      </div>
    </section>
  );
}

function formatProbability(pc) {
  return Number.isFinite(pc) ? pc.toExponential(2).replace("e-", "e−") : "—";
}

function RiskEvaluator() {
  const [pc, setPc] = useState("1e-7");
  const [distance, setDistance] = useState("5.01");
  const [result, setResult] = useState(null);
  const [caseResults, setCaseResults] = useState([]);
  const passedCases = caseResults.filter((item) => item.passed).length;

  function evaluate() {
    try {
      const evaluatedPc = Number(pc);
      const evaluatedDistance = Number(distance);
      const classification = classifyCollisionRisk(evaluatedPc, evaluatedDistance);
      setResult({
        classification,
        error: null,
        pc: evaluatedPc,
        distance: evaluatedDistance,
      });
    } catch (error) {
      setResult({ classification: null, error: error.message });
    }
  }

  function runCase(scenario) {
    setPc(String(scenario.pc));
    setDistance(String(scenario.missDistanceKm));
    const actual = classifyCollisionRisk(scenario.pc, scenario.missDistanceKm);
    setResult({
      classification: actual,
      error: null,
      pc: scenario.pc,
      distance: scenario.missDistanceKm,
      scenario: scenario.id,
    });
  }

  function runAllCases() {
    setCaseResults(riskTestCases.map((scenario) => {
      const actual = classifyCollisionRisk(scenario.pc, scenario.missDistanceKm);
      return { id: scenario.id, actual, expected: scenario.expected, passed: actual === scenario.expected };
    }));
  }

  return (
    <section className="evaluator-section" id="evaluator">
      <div className="section-heading">
        <div><span className="panel-eyebrow">PROJECT-BRIEF SCREENING THRESHOLDS</span><h2>Collision risk evaluator</h2></div>
        <span className="dataset-source-note">Deterministic policy · not model confidence</span>
      </div>
      <div className="evaluator-panel">
        <div className="evaluator-columns">
          <form className="evaluator-form" onSubmit={(event) => { event.preventDefault(); evaluate(); }}>
            <div className="evaluator-form-heading"><Icon name="crosshair" size={18} /><div><strong>Evaluate a conjunction</strong><span>Enter Pc and closest miss distance.</span></div></div>
            <label>Collision probability (Pc)<span className="input-hint">e.g. 1e-5</span>
              <input aria-label="Collision probability Pc" type="number" step="any" min="0" max="1" value={pc} onChange={(event) => setPc(event.target.value)} />
            </label>
            <label>Miss distance <span className="input-hint">kilometers</span>
              <input aria-label="Miss distance in kilometers" type="number" step="any" min="0" value={distance} onChange={(event) => setDistance(event.target.value)} />
            </label>
            <button type="submit" className="evaluator-submit"><Icon name="crosshair" size={15} /> Evaluate risk</button>
            {result && (
              <div className={`evaluation-result ${result.error ? "error" : result.classification}`} role="status" aria-live="polite">
                {result.error ? <><strong>Invalid input</strong><span>{result.error}</span></> : <>
                  <span>{result.scenario ? `${result.scenario} · ` : ""}SCREENING RESULT</span>
                  <strong>{result.classification} {result.classification === "critical" && <em>· maneuver review</em>}</strong>
                  <small>Pc {formatProbability(result.pc)} · miss {formatRaw(result.distance)} km</small>
                </>}
              </div>
            )}
          </form>

          <div className="policy-card">
            <div className="evaluator-form-heading"><Icon name="shield" size={18} /><div><strong>Configured risk tiers</strong><span>Critical rules take precedence; other conditions are combined with OR.</span></div></div>
            <div className="policy-tier critical"><i /><strong>Critical</strong><span>Pc ≥ 1e-4 <b>OR</b> miss &lt; 1 km</span></div>
            <div className="policy-tier elevated"><i /><strong>Elevated</strong><span>1e-6 ≤ Pc &lt; 1e-4 <b>OR</b> 1 km ≤ miss ≤ 5 km</span></div>
            <div className="policy-tier safe"><i /><strong>Safe</strong><span>Pc &lt; 1e-6 <b>AND</b> miss &gt; 5 km</span></div>
            <p className="policy-note">These are the screening conditions from your brief. Confirm the final operational thresholds with your mission team and the referenced NASA/ESA guidance.</p>
          </div>
        </div>

        <div className="case-suite">
          <div className="case-suite-heading">
            <div><strong>Threshold test cases</strong><span>Click a case to load and evaluate it.</span></div>
            <button className="run-cases-button" type="button" onClick={runAllCases}>Run all {riskTestCases.length} cases</button>
          </div>
          {caseResults.length > 0 && (
            <div className={`case-suite-status ${passedCases === riskTestCases.length ? "passed" : "failed"}`} role="status">
              {passedCases === riskTestCases.length ? "All boundary tests passed" : "Some tests failed"} · {passedCases}/{riskTestCases.length}
            </div>
          )}
          <div className="test-case-list">
            {riskTestCases.map((scenario) => {
              const status = caseResults.find((item) => item.id === scenario.id);
              return (
                <button className="test-case-row" key={scenario.id} type="button" onClick={() => runCase(scenario)}>
                  <span className={`case-status ${status ? (status.passed ? "passed" : "failed") : ""}`}>{status ? (status.passed ? "✓" : "!") : "↗"}</span>
                  <span className="test-case-name"><strong>{scenario.id}</strong><small>{scenario.name}</small></span>
                  <span className="test-case-inputs">Pc {formatProbability(scenario.pc)} <i /> {formatRaw(scenario.missDistanceKm)} km</span>
                  <span className={`test-case-expected ${scenario.expected}`}>{scenario.expected}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelEvaluation() {
  const { model } = datasetSummary;
  const { modelEvaluation, warningWindow } = datasetSummary.splits.test;
  const critical = modelEvaluation.classMetrics.critical;
  const earliestTestHours = datasetSummary.splits.test.timeRangeDays.min * 24;
  return (
    <section className="model-section" id="model">
      <div className="section-heading">
        <div><span className="panel-eyebrow">TRAIN SPLIT → HELD-OUT TEST SPLIT</span><h2>AI model &amp; 24-hour warnings</h2></div>
        <span className="model-kind">{model.algorithm}</span>
      </div>
      <div className="model-panel">
        <div className="model-stat-grid">
          <article><span>Test Pc error (MAE)</span><strong>{formatRaw(modelEvaluation.meanAbsoluteError)} <small>log10 units</small></strong></article>
          <article><span>Test tier accuracy</span><strong>{(modelEvaluation.accuracy * 100).toFixed(1)}<small>%</small></strong></article>
          <article><span>Critical recall</span><strong>{(critical.recall * 100).toFixed(1)}<small>%</small></strong></article>
          <article><span>Elevated recall</span><strong>{(modelEvaluation.classMetrics.elevated.recall * 100).toFixed(1)}<small>%</small></strong></article>
        </div>
        <div className={`warning-window ${warningWindow.uniqueConjunctions ? "has-events" : ""}`}>
          <span className="warning-icon"><Icon name="clock" size={17} /></span>
          <div className="warning-copy">
            <strong>Next 24 hours · held-out test split</strong>
            <span>{warningWindow.uniqueConjunctions
              ? `${warningWindow.uniqueConjunctions.toLocaleString()} unique conjunctions observed; ${warningWindow.actionableConjunctions.toLocaleString()} elevated or critical, ${warningWindow.withinFiveKmConjunctions.toLocaleString()} within 5 km.`
              : `No test observations fall inside the 24-hour window. The earliest test TCA is ${formatRaw(earliestTestHours)} hours away.`}</span>
            <small>Training reference (historical, not live): {datasetSummary.splits.train.warningWindow.uniqueConjunctions.toLocaleString()} unique conjunctions within 24 h; {datasetSummary.splits.train.warningWindow.actionableConjunctions.toLocaleString()} were elevated or critical.</small>
          </div>
          <div className="warning-count"><strong>{warningWindow.actionableConjunctions.toLocaleString()}</strong><span>actionable</span></div>
        </div>
        <div className="model-explanation">
          <Icon name="spark" size={16} />
          <p>Model: {model.trainRows.toLocaleString()} training rows; {modelEvaluation.rows.toLocaleString()} held-out test rows. Inputs are restricted to the 12 permitted telemetry fields. Risk tiers are derived using Pc <code>10 ** risk</code> and the distance rules above. Metrics are row-level, so repeated messages from one conjunction are not statistically independent. Because miss distance is also part of the screening label, tier scores partly reflect reproducing that rule. Test Pc MAE is {formatRaw(modelEvaluation.meanAbsoluteError)} log10 units (R² {formatRaw(modelEvaluation.rSquared)}): treat predicted probabilities as experimental, not calibrated operational Pc.</p>
        </div>
        <div className="model-reliability-note" role="note">
          <strong>Probability calibration warning</strong>
          <span>A {formatRaw(modelEvaluation.meanAbsoluteError)} log10(Pc) test error means the model&apos;s probability estimates are not yet reliable for real maneuver decisions. This prototype is for exploration; do not make operational decisions from model predictions.</span>
        </div>
      </div>
    </section>
  );
}

function Analytics() {
  return (
    <section className="analytics-section" id="analytics">
      <div className="analytics-icon"><Icon name="spark" size={20} /></div>
      <div className="analytics-copy"><span>READY FOR THE NEXT STEP</span><h3>Train a collision-risk model</h3><p>Use training rows to fit a model, then evaluate predictions against the labeled test split. Keep the two splits separate.</p></div>
      <div className="analytics-stat"><strong>{datasetSummary.splits.train.featureColumns}</strong><span>input features</span></div>
      <div className="analytics-stat"><strong>2</strong><span>labeled data splits</span></div>
      <button className="analytics-action" type="button" onClick={() => document.getElementById("datasets")?.scrollIntoView({ behavior: "smooth" })}>Review dataset <Icon name="arrow" size={15} /></button>
    </section>
  );
}

function App() {
  const [selectedEvent, setSelectedEvent] = useState(events[0]);
  const [scheduled, setScheduled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="app-shell" id="overview">
      <Sidebar />
      <main className="main-content">
        <Topbar query={searchTerm} onQueryChange={setSearchTerm} />
        <div className="dashboard-content">
          <section className="page-heading">
            <div><div className="greeting">AI-ASSISTED COLLISION AVOIDANCE <span className="greeting-dot" /> TRAINING + TEST DATA</div><h1>Safer satellite orbits <span>✦</span></h1><p>Explore the supplied conjunction dataset and the signals an AI risk model could learn from.</p></div>
            <button type="button" className="export-button" onClick={() => window.print()}><Icon name="download" size={16} /> Export report</button>
          </section>
          <section className="metrics-grid" aria-label="Supplied dataset overview">
            <MetricCard label="Training conjunctions" value={datasetSummary.splits.train.uniqueConjunctions.toLocaleString()} detail={`${datasetSummary.splits.train.rows.toLocaleString()} telemetry rows`} icon="satellite" tone="blue" />
            <MetricCard label="Held-out test events" value={datasetSummary.splits.test.uniqueConjunctions.toLocaleString()} detail={`${datasetSummary.splits.test.rows.toLocaleString()} test rows`} icon="orbit" tone="teal" />
            <MetricCard label="Critical recall" value={`${(datasetSummary.splits.test.modelEvaluation.classMetrics.critical.recall * 100).toFixed(1)}%`} detail="Held-out test labels" icon="crosshair" tone="amber" />
            <MetricCard label="24h test warnings" value={datasetSummary.splits.test.warningWindow.actionableConjunctions.toLocaleString()} detail="No unseen live telemetry" icon="shield" tone="green" />
          </section>
          <RiskEvaluator />
          <ModelEvaluation />
          <DatasetAnalytics />
          <section className="orbital-section">
            <div className="section-heading orbital-heading">
                <div><span className="panel-eyebrow">ILLUSTRATIVE DEMO · NOT FROM CSV DATA</span><h2>Orbital overview</h2></div>
                <div className="map-time"><span className="demo-dot" /> DEMO DATA <span>·</span> 12:24 UTC</div>
            </div>
            <div className="orbital-layout">
              <div className="map-card"><OrbitMap selectedEvent={selectedEvent} /></div>
              <RiskSummary event={selectedEvent} onSchedule={() => setScheduled(!scheduled)} scheduled={scheduled} />
            </div>
          </section>
          <div className="demo-section-label">Demo-only spacecraft and conjunction examples below are illustrative and are not derived from the supplied datasets.</div>
          <Conjunctions selectedEvent={selectedEvent} onSelect={(event) => { setSelectedEvent(event); setScheduled(false); }} searchTerm={searchTerm} />
          <FleetHealth />
          <Analytics />
          <footer className="dashboard-footer"><span>© 2026 Orbital Systems</span><span>Illustrative data · not live telemetry <i className="demo-dot" /></span><a href="#overview">Prototype environment</a></footer>
        </div>
      </main>
      <div className="search-bridge" aria-hidden="true" />
    </div>
  );
}

export default App;
