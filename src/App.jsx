import { useMemo, useState } from "react";

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
        <div className="workspace-copy"><strong>Northstar Space</strong><span>Mission control</span></div>
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
        <div><span className="panel-eyebrow">CLOSEST APPROACH</span><span className="risk-badge"><i /> {event.risk} risk</span></div>
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
        <div><span className="panel-eyebrow">AI-PRIORITIZED · SAMPLE DATA</span><h2>Upcoming conjunctions <span className="heading-count">12</span></h2></div>
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
        <div><span className="panel-eyebrow">SPACECRAFT STATUS</span><h2>Fleet health</h2></div>
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

function Analytics() {
  return (
    <section className="analytics-section" id="analytics">
      <div className="analytics-icon"><Icon name="spark" size={20} /></div>
      <div className="analytics-copy"><span>ORBITAL AI · DECISION-SUPPORT CONCEPT</span><h3>Earlier signals. Safer orbits.</h3><p>Explore how AI-assisted risk scoring could prioritize conjunctions using orbital data and uncertainty estimates.</p></div>
      <div className="analytics-stat"><strong>94.8<span>%</span></strong><span>prediction confidence</span></div>
      <div className="analytics-stat"><strong>6.2<span>h</span></strong><span>average lead time</span></div>
      <button className="analytics-action" type="button" onClick={() => document.getElementById("conjunctions")?.scrollIntoView({ behavior: "smooth" })}>Explore insights <Icon name="arrow" size={15} /></button>
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
            <div><div className="greeting">SATURDAY, 31 OCTOBER 2026 <span className="greeting-dot" /> ORBITAL DAY 304</div><h1>Good morning, Alex <span>✦</span></h1><p>Here&apos;s what&apos;s happening across your fleet today.</p></div>
            <button type="button" className="export-button" onClick={() => window.print()}><Icon name="download" size={16} /> Export report</button>
          </section>
          <section className="metrics-grid" aria-label="Fleet overview">
            <MetricCard label="Active spacecraft" value="248" detail="Across 3 orbital bands" icon="satellite" tone="blue" trend="+12" />
            <MetricCard label="Tracked objects" value="18,420" detail="Illustrative catalog" icon="orbit" tone="teal" trend="+2.4%" />
            <MetricCard label="Upcoming conjunctions" value="12" detail="In the next 24 hours" icon="crosshair" tone="amber" trend="3 high risk" />
            <MetricCard label="Maneuvers avoided" value="98.6%" detail="Successful this quarter" icon="shield" tone="green" trend="↑ 1.2%" />
          </section>
          <section className="orbital-section">
            <div className="section-heading orbital-heading">
                <div><span className="panel-eyebrow">SITUATIONAL AWARENESS · SIMULATION</span><h2>Orbital overview</h2></div>
                <div className="map-time"><span className="demo-dot" /> DEMO DATA <span>·</span> 12:24 UTC</div>
            </div>
            <div className="orbital-layout">
              <div className="map-card"><OrbitMap selectedEvent={selectedEvent} /></div>
              <RiskSummary event={selectedEvent} onSchedule={() => setScheduled(!scheduled)} scheduled={scheduled} />
            </div>
          </section>
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
