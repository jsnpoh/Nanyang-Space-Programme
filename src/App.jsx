import { useEffect, useRef, useState } from "react";
import { parseEventLabels, summarizeCsvFile, summarizeCsvStream } from "./datasetUpload.js";

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
  { label: "Upload data", icon: "download", href: "#upload" },
  { label: "Training data", icon: "chart", href: "#training" },
  { label: "Test data", icon: "chart", href: "#test" },
  { label: "Dataset analysis", icon: "chart", href: "#datasets" },
  { label: "Model evaluation", icon: "chart", href: "#model" },
  { label: "Analytics", icon: "chart", href: "#analytics" },
  { label: "Help", icon: "help", href: "#help" },
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
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.8c-1.1 1.1-1.9 1.4-1.9 3" /><path d="M12 17.5h.01" /></>,
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

function Brand({ onNavigate }) {
  return (
    <a className="brand" href="#overview" aria-label="Orbital home" onClick={(event) => { event.preventDefault(); onNavigate("#overview"); }}>
      <span className="brand-icon"><Icon name="orbit" size={20} /></span>
      <span>orbital<span className="brand-period">.</span></span>
    </a>
  );
}

function Sidebar({ activeHref, onNavigate }) {
  return (
    <aside className="sidebar">
      <Brand onNavigate={onNavigate} />
      <div className="workspace-switcher">
        <div className="workspace-avatar">N</div>
        <div className="workspace-copy"><strong>Nanyang Space Programme</strong><span>Mission control</span></div>
        <span className="workspace-caret">⌄</span>
      </div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <a
            className={`side-link ${activeHref === item.href ? "active" : ""}`}
            href={item.href}
            key={item.label}
            aria-current={activeHref === item.href ? "page" : undefined}
            onClick={(event) => { event.preventDefault(); onNavigate(item.href); }}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
            {item.count && <span className="nav-count">{item.count}</span>}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-card">
          <span className="connection-icon"><Icon name="shield" size={17} /></span>
          <div><strong>Local processing</strong><span>CSV data stays on this app</span></div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ activeLabel }) {
  return (
    <div className="topbar">
      <div className="breadcrumbs"><span>Mission control</span><Icon name="chevron" size={14} /><strong>{activeLabel}</strong></div>
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

function EarthOrbitIllustration() {
  return (
    <figure className="earth-orbit-illustration">
      <svg viewBox="0 0 520 340" role="img" aria-labelledby="earth-orbit-title">
        <title id="earth-orbit-title">Illustration of Earth and an orbiting satellite</title>
        <defs>
          <radialGradient id="illustrationEarth" cx="34%" cy="28%" r="74%">
            <stop offset="0%" stopColor="#b6e4f4" />
            <stop offset="62%" stopColor="#4a9cc2" />
            <stop offset="100%" stopColor="#23628e" />
          </radialGradient>
          <radialGradient id="illustrationGlow">
            <stop offset="0%" stopColor="#8edaf0" stopOpacity=".22" />
            <stop offset="100%" stopColor="#8edaf0" stopOpacity="0" />
          </radialGradient>
          <clipPath id="illustrationEarthClip"><circle cx="260" cy="191" r="89" /></clipPath>
        </defs>
        <circle cx="260" cy="191" r="148" fill="url(#illustrationGlow)" />
        <g className="illustration-stars">
          <circle cx="74" cy="75" r="2" /><circle cx="430" cy="70" r="1.5" />
          <circle cx="458" cy="242" r="2" /><circle cx="95" cy="259" r="1.5" />
          <circle cx="164" cy="42" r="1.3" /><circle cx="363" cy="299" r="1.5" />
        </g>
        <ellipse className="illustration-orbit" cx="260" cy="191" rx="211" ry="78" transform="rotate(-24 260 191)" />
        <ellipse className="illustration-orbit illustration-orbit-secondary" cx="260" cy="191" rx="202" ry="106" transform="rotate(36 260 191)" />
        <circle className="illustration-earth" cx="260" cy="191" r="89" />
        <g clipPath="url(#illustrationEarthClip)" className="illustration-land">
          <path d="m202 145 22-18 25 4 14 16-9 12-18 2-8 17-20-2-14-13Z" />
          <path d="m240 184 19-9 16 11 7 19-12 17 2 22-15 19-14-12-1-21-14-20Z" />
          <path d="m280 123 26-9 20 12 4 17-15 13-21-5-14 8-12-15Z" />
          <path d="m324 174 23-8 22 13 7 16-14 10-19-4-10 13-15-9Z" />
        </g>
        <g className="illustration-satellite" transform="translate(390 105) rotate(-24)">
          <path d="M-19 0h38M0-19v38" />
          <rect x="-8" y="-8" width="16" height="16" rx="3" />
          <rect x="-31" y="-8" width="12" height="16" rx="2" />
          <rect x="19" y="-8" width="12" height="16" rx="2" />
          <path d="m0-8 0-14m-5 0h10" />
        </g>
        <circle className="illustration-satellite-signal" cx="390" cy="105" r="16" />
      </svg>
      <figcaption>Orbital illustration · not live tracking</figcaption>
    </figure>
  );
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  return Math.abs(meters) >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function OrbitGeometryView({ encounter }) {
  const orbit = encounter?.orbit;
  const points = (encounter?.trajectory ?? []).filter((point) => Number.isFinite(point.relativeT) && Number.isFinite(point.relativeN));
  const [progress, setProgress] = useState(0);
  const [yaw, setYaw] = useState(-0.7);
  const dragRef = useRef(null);
  const eventId = encounter?.eventId;

  useEffect(() => {
    if (points.length < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return undefined;
    }
    const travelMs = 7000;
    const holdMs = 1800;
    let frame;
    let last = performance.now();
    const start = last;
    const tick = (now) => {
      const elapsed = (now - start) % (travelMs + holdMs);
      const linear = Math.min(elapsed / travelMs, 1);
      setProgress(linear * linear * (3 - 2 * linear));
      if (!dragRef.current) setYaw((value) => value + (now - last) * 0.00018);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [eventId, points.length]);

  if (!encounter || points.length < 2) return <EarthOrbitIllustration />;

  const size = 300;
  const center = size / 2;
  const pitch = 0.5;
  const extent = Math.max(
    ...points.map((point) => Math.max(Math.abs(point.relativeT), Math.abs(point.relativeN), Math.abs(point.relativeR ?? 0))),
    1,
  ) * 1.1;
  const unit = 108 / extent;
  const project = (t, r, n) => {
    const x = t * unit;
    const y = r * unit;
    const z = n * unit;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const depth = 1 / (1 - z2 / 520);
    return { x: center + x1 * depth, y: center - y1 * depth, depth };
  };
  const screen = (point) => project(point.relativeT, point.relativeR ?? 0, point.relativeN);
  const path = points.map(screen);

  const position = progress * (points.length - 1);
  const index = Math.min(Math.floor(position), points.length - 2);
  const fraction = position - index;
  const mix = (key) => {
    const from = points[index][key] ?? 0;
    const to = points[index + 1][key] ?? 0;
    return from + (to - from) * fraction;
  };
  const chaser = project(mix("relativeT"), mix("relativeR"), mix("relativeN"));
  const floorChaser = project(mix("relativeT"), -extent, mix("relativeN"));
  const separation = Number.isFinite(points[index].missDistanceMeters) && Number.isFinite(points[index + 1].missDistanceMeters)
    ? mix("missDistanceMeters")
    : null;
  const daysToTca = Number.isFinite(points[index].timeToTcaDays) && Number.isFinite(points[index + 1].timeToTcaDays)
    ? mix("timeToTcaDays")
    : null;
  const trail = [...path.slice(0, index + 1), chaser].map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const closest = Number.isFinite(encounter.closestRelativeT) && Number.isFinite(encounter.closestRelativeN)
    ? project(encounter.closestRelativeT, encounter.closestRelativeR ?? 0, encounter.closestRelativeN)
    : null;
  const origin = project(0, 0, 0);

  const gridSteps = [-1, -0.5, 0, 0.5, 1];
  const gridLines = gridSteps.flatMap((step) => [
    [project(-extent, -extent, step * extent), project(extent, -extent, step * extent)],
    [project(step * extent, -extent, -extent), project(step * extent, -extent, extent)],
  ]);
  const axes = [
    { label: "T", end: project(extent, 0, 0) },
    { label: "R", end: project(0, extent, 0) },
    { label: "N", end: project(0, 0, extent) },
  ];
  const missLabel = Number.isFinite(encounter.minMissDistanceMeters) ? formatDistance(encounter.minMissDistanceMeters) : "—";
  const crossing = orbit && Number.isFinite(orbit.targetIncDeg) && Number.isFinite(orbit.chaserIncDeg)
    ? Math.abs(orbit.targetIncDeg - orbit.chaserIncDeg)
    : null;

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = event.clientX;
  };
  const onPointerMove = (event) => {
    if (dragRef.current === null) return;
    setYaw((value) => value + (event.clientX - dragRef.current) * 0.01);
    dragRef.current = event.clientX;
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <figure className="earth-orbit-illustration orbit-geometry close-approach">
      <div className="close-approach-readout">
        <div><span>Time to closest approach</span><strong>{Number.isFinite(daysToTca) ? `${(daysToTca * 24).toFixed(1)} h` : "—"}</strong></div>
        <div><span>Separation</span><strong>{formatDistance(separation)}</strong></div>
      </div>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby="close-approach-title"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <title id="close-approach-title">3D animation of the chaser object passing the target along the observed relative path for event {encounter.eventId}. Drag to rotate.</title>
        <defs>
          <radialGradient id="approachTargetFill" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#8cc4ff" />
            <stop offset="100%" stopColor="#0a5fd0" />
          </radialGradient>
          <radialGradient id="approachChaserFill" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffd9a0" />
            <stop offset="100%" stopColor="#f08a00" />
          </radialGradient>
        </defs>
        <g className="approach-floor">
          {gridLines.map(([from, to], i) => <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />)}
        </g>
        {axes.map(({ label, end }) => (
          <g key={label}>
            <line className="approach-axis-3d" x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} />
            <text className="approach-axis-label" x={end.x + 4} y={end.y + 3}>{label}</text>
          </g>
        ))}
        <polyline className="approach-path" points={path.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
        <line className="approach-drop" x1={chaser.x} y1={chaser.y} x2={floorChaser.x} y2={floorChaser.y} />
        <ellipse className="approach-shadow" cx={floorChaser.x} cy={floorChaser.y} rx={7 * floorChaser.depth} ry={3 * floorChaser.depth} />
        <polyline className="approach-trail" points={trail} />
        {closest && (
          <g>
            <circle className="approach-closest-pulse" cx={closest.x} cy={closest.y} r="6" />
            <circle className="approach-closest" cx={closest.x} cy={closest.y} r="3" />
          </g>
        )}
        <line className="approach-link" x1={origin.x} y1={origin.y} x2={chaser.x} y2={chaser.y} />
        <circle className="approach-target-halo" cx={origin.x} cy={origin.y} r="15" />
        <circle cx={origin.x} cy={origin.y} r={7 * origin.depth} fill="url(#approachTargetFill)" />
        <circle className="approach-chaser-halo" cx={chaser.x} cy={chaser.y} r={11 * chaser.depth} />
        <circle cx={chaser.x} cy={chaser.y} r={5.5 * chaser.depth} fill="url(#approachChaserFill)" />
      </svg>
      <div className="approach-legend">
        <span><i className="geometry-key target" />Target (fixed)</span>
        <span><i className="geometry-key chaser" />Chaser{encounter.chaserObjectType ? ` · ${encounter.chaserObjectType.toLowerCase()}` : ""}</span>
        {crossing !== null && <span>Plane angle {crossing.toFixed(1)}°</span>}
        <span className="approach-hint">Drag to rotate</span>
      </div>
      <figcaption>Event {encounter.eventId} · 3D replay of the CSV's relative position (R radial, T along-track, N cross-track) · closest miss {missLabel} · not a live track</figcaption>
    </figure>
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

function RiskSummary({ event, onSchedule, scheduled, onViewAnalysis }) {
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
      <button className="analysis-link" type="button" onClick={onViewAnalysis}>
        View model evaluation <Icon name="arrow" size={14} />
      </button>
    </aside>
  );
}

function Conjunctions({ selectedEvent, onSelect, searchTerm, compact = false, onViewAll }) {
  const [filter, setFilter] = useState("All events");
  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesSearch = `${event.id} ${event.object} ${event.secondary}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "All events" || event.risk === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  }), [filter, searchTerm]);

  return (
    <section className={`conjunction-section ${compact ? "compact-conjunctions" : ""}`} id="conjunctions">
      <div className="section-heading">
        <div><span className="panel-eyebrow">{compact ? "UPCOMING · DEMO DATA" : "DEMO DATA · NOT FROM CSV"}</span><h2>{compact ? "Conjunction watch" : "Example conjunctions"} <span className="heading-count">12</span></h2></div>
        <button className="view-all-button" type="button" onClick={compact ? onViewAll : () => setFilter(filter === "All events" ? "High" : "All events")}>
          {compact ? "View all events" : filter === "All events" ? "View all events" : "Show all"} <Icon name="arrow" size={14} />
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

function LegacyDatasetAnalytics() {
  const [selectedSplit, setSelectedSplit] = useState("train");
  const dataset = datasetSummary.splits[selectedSplit];
  const riskStats = dataset.stats.risk;
  const previewRows = selectedSplit === "test"
    ? eventModelSummary.test.topPredictions.map((record) => ({
        eventId: record.eventId,
        confidence: record.confidence,
        actualRisk: null,
        predictedPc: null,
        missDistance: record.missDistanceMeters,
        predictedTier: record.predictedTier,
        timeToTcaDays: record.timeToTcaDays,
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
          <div className="tier-summary-heading"><span>Rule-based labels</span><small>{selectedSplit === "test" ? "Current message values · not final event outcomes" : "Telemetry rows · not unique events"}</small></div>
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
              <div><h3>{selectedSplit === "test" ? "Unlabeled test event predictions" : "Highest-risk training observations"}</h3><span>{selectedSplit === "test" ? "Latest message ≥2 days before TCA; final outcomes unavailable" : "Observed training labels; not model predictions"}</span></div>
              <span className="rows-count">8 rows</span>
            </div>
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead><tr><th>EVENT / OBS.</th><th>{selectedSplit === "test" ? "PREDICTED TIER" : "MODEL CLASS"}</th><th>{selectedSplit === "test" ? "CONFIDENCE" : "PRED. Pc"}</th><th>{selectedSplit === "test" ? "FINAL LABEL" : "TRUE log10(Pc)"}</th><th>MISS (KM)</th></tr></thead>
                <tbody>{previewRows.map((record) => (
                  <tr key={selectedSplit === "test" ? record.eventId : record.row}>
                    <td>{record.eventId}<small>{selectedSplit === "test" ? `TCA in ${formatRaw(record.timeToTcaDays)} days` : `Row ${record.row.toLocaleString()}`}</small></td>
                    <td><span className={`table-tier ${record.predictedTier}`}>{selectedSplit === "test" ? record.predictedTier : "Observed"}</span></td>
                    <td>{selectedSplit === "test" ? `${(record.confidence * 100).toFixed(1)}%` : formatProbability(record.predictedPc)}</td>
                    <td className="target-value">{selectedSplit === "test" ? "Unavailable" : formatRaw(record.actualRisk)}</td>
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

function formatProbability(pc, fractionDigits = 2) {
  return Number.isFinite(pc) ? pc.toExponential(fractionDigits).replace("e-", "e−") : "—";
}

function RiskEvaluator() {
  const minimumPc = 1e-7;
  const maximumPc = 1e-4;
  const [pcMantissaTenths, setPcMantissaTenths] = useState(10);
  const [pcExponent, setPcExponent] = useState(-7);
  const [distance, setDistance] = useState("5.01");
  const [result, setResult] = useState(null);
  const [caseResults, setCaseResults] = useState([]);
  const passedCases = caseResults.filter((item) => item.passed).length;
  const pcMantissa = pcMantissaTenths / 10;
  const pc = pcMantissa * 10 ** pcExponent;

  function canSetPc(mantissaTenths, exponent) {
    const value = (mantissaTenths / 10) * 10 ** exponent;
    return value >= minimumPc && value <= maximumPc;
  }

  function stepPcMantissa(direction) {
    const nextMantissaTenths = pcMantissaTenths + direction;
    if (canSetPc(nextMantissaTenths, pcExponent)) {
      setPcMantissaTenths(nextMantissaTenths);
    }
  }

  function stepPcExponent(direction) {
    const nextExponent = pcExponent + direction;
    if (canSetPc(pcMantissaTenths, nextExponent)) {
      setPcExponent(nextExponent);
    }
  }

  function evaluate() {
    try {
      const evaluatedDistance = Number(distance);
      const classification = classifyCollisionRisk(pc, evaluatedDistance);
      setResult({
        classification,
        error: null,
        pc,
        distance: evaluatedDistance,
      });
    } catch (error) {
      setResult({ classification: null, error: error.message });
    }
  }

  function runCase(scenario) {
    const [mantissa, exponent] = scenario.pc.toExponential(1).split("e").map(Number);
    setPcMantissaTenths(Math.round(mantissa * 10));
    setPcExponent(exponent);
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
            <div className="evaluator-form-heading"><Icon name="crosshair" size={18} /><div><strong>Evaluate a conjunction</strong><span>Adjust Pc and enter the closest miss distance.</span></div></div>
            <div className="pc-value">
              <span>Collision probability (Pc)</span>
              <output aria-live="polite">{formatProbability(pc, 1)}</output>
              <small>Range {formatProbability(minimumPc, 1)}–{formatProbability(maximumPc, 1)}</small>
            </div>
            <div className="pc-controls">
              <div className="pc-control">
                <span>Mantissa <small>step 0.1</small></span>
                <div>
                  <button type="button" aria-label="Decrease Pc mantissa by 0.1" disabled={pcMantissaTenths <= 10 || !canSetPc(pcMantissaTenths - 1, pcExponent)} onClick={() => stepPcMantissa(-1)}>−</button>
                  <output>{pcMantissa.toFixed(1)}</output>
                  <button type="button" aria-label="Increase Pc mantissa by 0.1" disabled={pcMantissaTenths >= 99 || !canSetPc(pcMantissaTenths + 1, pcExponent)} onClick={() => stepPcMantissa(1)}>+</button>
                </div>
              </div>
              <div className="pc-control">
                <span>Exponent <small>step 1</small></span>
                <div>
                  <button type="button" aria-label="Decrease Pc exponent by 1" disabled={pcExponent <= -7 || !canSetPc(pcMantissaTenths, pcExponent - 1)} onClick={() => stepPcExponent(-1)}>−</button>
                  <output>{pcExponent}</output>
                  <button type="button" aria-label="Increase Pc exponent by 1" disabled={pcExponent >= -4 || !canSetPc(pcMantissaTenths, pcExponent + 1)} onClick={() => stepPcExponent(1)}>+</button>
                </div>
              </div>
            </div>
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

function CsvScreening() {
  const fileInputRef = useRef(null);
  const [screening, setScreening] = useState(null);
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);

  async function importCsv(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setScreening(null);
    setError("");
    setIsReading(true);
    try {
      if (!/\.(csv|txt)$/i.test(file.name)) {
        throw new Error("Choose a .csv file or a plain-text .txt file containing CSV-formatted data.");
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("CSV files must be 50 MB or smaller. Split larger datasets into smaller files.");
      }
      const parsed = screenCsvContent(await file.text());
      setScreening({ ...parsed, fileName: file.name });
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "The CSV file could not be screened.");
    } finally {
      setIsReading(false);
    }
  }

  function downloadTemplate() {
    const content = "event_id,pc,miss_distance_m,time_to_tca\nCDM-EXAMPLE,1e-5,2500,0.5\n";
    downloadCsv("conjunction-screening-template.csv", content);
  }

  function downloadResults() {
    if (!screening) return;
    downloadCsv("screened-conjunctions.csv", createScreenedCsv(screening.headers, screening.screenedRows));
  }

  const tierCounts = screening?.screenedRows.reduce((counts, row) => {
    counts[row.classification] += 1;
    return counts;
  }, { safe: 0, elevated: 0, critical: 0 });
  const rowsWithin24Hours = screening?.screenedRows.filter((row) =>
    row.timeToTcaDays !== null && row.timeToTcaDays >= 0 && row.timeToTcaDays <= 1,
  ) ?? [];
  const actionableWithin24Hours = new Set(
    rowsWithin24Hours
      .filter((row) => row.classification !== "safe")
      .map((row) => row.eventId),
  ).size;

  return (
    <section className="csv-screening-section" id="upload">
      <div className="section-heading">
        <div><span className="panel-eyebrow">LOCAL CSV SCREENING · NO FILE UPLOAD</span><h2>Screen a new dataset</h2></div>
        <span className="dataset-source-note">Up to 50 MB · 100,000 rows</span>
      </div>
      <div className="csv-screening-panel">
        <div className="csv-upload-controls">
          <div className="csv-upload-copy">
            <strong>Choose a conjunction CSV</strong>
            <span>Applies the screening rules to Pc and miss distance; it does not retrain the risk model. Your file stays in this browser.</span>
          </div>
          <div className="csv-upload-actions">
            <button type="button" className="csv-template-button" onClick={downloadTemplate}>Download CSV template</button>
            <input ref={fileInputRef} className="screening-file-input" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={importCsv} aria-label="Choose conjunction CSV or text file" />
            <button type="button" className="csv-upload-button" disabled={isReading} onClick={() => fileInputRef.current?.click()}>
              <Icon name="plus" size={15} />{isReading ? "Screening file..." : "Choose file"}
            </button>
          </div>
        </div>
        <div className="csv-format-help">
          Required columns: <code>pc</code> (0–1) or <code>risk</code> (log10(Pc)), plus a miss-distance column. Workbook event labels using <code>final_risk_log10_pc</code> and <code>final_miss_distance_m</code> are supported; introductory note rows are skipped.
        </div>
        {error && <div className="csv-import-message error" role="alert">{error}</div>}
        {screening && (
          <div className="csv-screening-results">
            <div className="csv-results-heading">
              <div><strong>{screening.fileName}</strong><span>{screening.screenedRows.length.toLocaleString()} screened{screening.rejectedRows.length ? ` · ${screening.rejectedRows.length.toLocaleString()} invalid rows skipped` : ""}</span></div>
              <button type="button" className="csv-download-button" onClick={downloadResults}><Icon name="download" size={14} /> Download results</button>
            </div>
            <div className="csv-tier-counts" aria-label="Screening result counts">
              <div><span>Safe</span><strong>{tierCounts.safe.toLocaleString()}</strong></div>
              <div><span>Elevated</span><strong>{tierCounts.elevated.toLocaleString()}</strong></div>
              <div><span>Critical</span><strong>{tierCounts.critical.toLocaleString()}</strong></div>
              {screening.headers.some((header) => header.trim().toLowerCase().replace(/[\s-]+/g, "_") === "time_to_tca") && (
                <div><span>Actionable within 24h</span><strong>{actionableWithin24Hours.toLocaleString()}</strong></div>
              )}
            </div>
            {screening.rejectedRows.length > 0 && (
              <div className="csv-invalid-rows" role="status">
                <strong>Rows needing attention</strong>
                {screening.rejectedRows.slice(0, 5).map((row) => <span key={row.rowNumber}>Row {row.rowNumber}: {row.reason}</span>)}
                {screening.rejectedRows.length > 5 && <span>And {screening.rejectedRows.length - 5} more invalid rows.</span>}
              </div>
            )}
            <div className="csv-results-table-wrap">
              <table className="csv-results-table">
                <thead><tr><th>EVENT ID</th><th>Pc</th><th>MISS (KM)</th><th>SCREENING RESULT</th></tr></thead>
                <tbody>{screening.screenedRows.slice(0, 100).map((row) => (
                  <tr key={row.csvRowNumber}>
                    <td>{row.eventId}</td>
                    <td>{formatProbability(row.pc)}</td>
                    <td>{formatRaw(row.missDistanceKm)}</td>
                    <td><span className={`table-tier ${row.classification}`}>{row.classification}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {screening.screenedRows.length > 100 && <div className="csv-results-footnote">Showing first 100 rows; the downloaded CSV includes all {screening.screenedRows.length.toLocaleString()} screened rows.</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function downloadCsv(fileName, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function LegacyModelEvaluation() {
  const { model, training, validation, test } = eventModelSummary;
  const modelEvaluation = validation.metrics;
  const critical = modelEvaluation.classMetrics.critical;
  return (
    <section className="model-section" id="model">
      <div className="section-heading">
        <div><span className="panel-eyebrow">EVENT-LEVEL TRAINING · GROUPED VALIDATION</span><h2>Event-tier model</h2></div>
        <span className="model-kind">{model.algorithm}</span>
      </div>
      <div className="model-panel">
        <div className="model-stat-grid">
          <article><span>Eligible training events</span><strong>{training.eligibleEvents.toLocaleString()}</strong></article>
          <article><span>Grouped validation events</span><strong>{modelEvaluation.events.toLocaleString()}</strong></article>
          <article><span>Validation accuracy</span><strong>{(modelEvaluation.accuracy * 100).toFixed(1)}<small>%</small></strong></article>
          <article><span>Critical recall</span><strong>{(critical.recall * 100).toFixed(1)}<small>%</small></strong></article>
        </div>
        <div className={`warning-window ${test.predictedTierCounts.critical ? "has-events" : ""}`}>
          <span className="warning-icon"><Icon name="clock" size={17} /></span>
          <div className="warning-copy">
            <strong>Test-set predictions · final labels unavailable</strong>
            <span>{test.eventsWithEligibleObservations.toLocaleString()} events with an eligible observation: {test.predictedTierCounts.safe.toLocaleString()} safe, {test.predictedTierCounts.elevated.toLocaleString()} elevated, {test.predictedTierCounts.critical.toLocaleString()} critical.</span>
            <small>These are model predictions, not verified event outcomes or a 24-hour warning count.</small>
          </div>
          <div className="warning-count"><strong>{(critical.recall * 100).toFixed(1)}%</strong><span>critical recall</span></div>
        </div>
        <div className="model-explanation">
          <Icon name="chart" size={16} />
          <p>Target: each event&apos;s workbook <code>final_tier</code>. Training uses one latest observation per event at least 2 days before TCA; {training.fitEvents.toLocaleString()} events fit the model and {modelEvaluation.events.toLocaleString()} separate events validate it. Events—not telemetry rows—are split, preventing messages from the same conjunction leaking across the split. The test data has no final labels, so its {test.eventsWithEligibleObservations.toLocaleString()} outputs are predictions only. Validation uses inverse-frequency class weights; balanced accuracy is {(modelEvaluation.balancedAccuracy * 100).toFixed(1)}%. Features include miss distance and risk-related telemetry, so this is a screening prototype, not operational maneuver guidance.</p>
        </div>
        <div className="model-reliability-note" role="note">
          <strong>Critical-tier validation warning</strong>
          <span>Critical recall is {(critical.recall * 100).toFixed(1)}% and precision is {(critical.precision * 100).toFixed(1)}% on grouped validation events. The classifier still produces false alerts and must not be used for real maneuver decisions. Test predictions cannot be accuracy-checked until final event labels are provided.</span>
        </div>
      </div>
    </section>
  );
}

function LegacyAnalytics() {
  return (
    <section className="analytics-section" id="analytics">
      <div className="analytics-icon"><Icon name="chart" size={20} /></div>
      <div className="analytics-copy"><span>MODEL PERFORMANCE</span><h3>Review collision-risk tiers</h3><p>Training and validation are grouped by event; test predictions remain unlabeled until final outcomes are supplied.</p></div>
      <div className="analytics-stat"><strong>{datasetSummary.splits.train.featureColumns}</strong><span>input features</span></div>
      <div className="analytics-stat"><strong>3</strong><span>risk tiers</span></div>
      <button className="analytics-action" type="button" onClick={() => document.getElementById("datasets")?.scrollIntoView({ behavior: "smooth" })}>Review dataset <Icon name="arrow" size={15} /></button>
    </section>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function DatasetUpload({ datasets, uploadStates, onUpload, onClear }) {
  const splits = [
    { key: "train", label: "Training dataset", description: "Upload the CSV used to fit your model." },
    { key: "test", label: "Test dataset", description: "Upload the held-out CSV used to evaluate your model." },
  ];

  return (
    <section className="upload-page">
      <div className="section-heading">
        <div><span className="panel-eyebrow">YOUR FILES · LOCAL PROCESSING</span><h2>Upload training and test data</h2></div>
      </div>
      <p className="upload-intro">The bundled training and test files load automatically. Choose a replacement if needed; CSV parsing runs locally in this browser.</p>
      <div className="upload-dataset-grid">
        {splits.map(({ key, label, description }) => {
          const dataset = datasets[key];
          const state = uploadStates[key];
          return (
            <article className="upload-dataset-card" key={key}>
              <span className="upload-dataset-icon"><Icon name={key === "train" ? "chart" : "shield"} size={19} /></span>
              <h3>{label}</h3>
              <p>{description}</p>
              {dataset ? (
                <div className="uploaded-file-summary" role="status">
                  <strong>{dataset.fileName}</strong>
                  <span>{dataset.rows.toLocaleString()} rows · {dataset.columns} columns · {formatBytes(dataset.size)}</span>
                </div>
              ) : (
                <div className="upload-prompt">No {key === "train" ? "training" : "test"} file selected</div>
              )}
              {state?.status === "reading" && (
                <div className="upload-progress" role="status">
                  <span>Reading CSV · {Math.round(state.progress * 100)}%</span>
                  <progress max="1" value={state.progress} />
                </div>
              )}
              {state?.error && <div className="csv-import-message error" role="alert">{state.error}</div>}
              <div className="upload-dataset-actions">
                <label className="csv-upload-button">
                  <Icon name="plus" size={15} />{dataset ? "Replace file" : "Choose CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    aria-label={`Choose ${key === "train" ? "training" : "test"} CSV`}
                    disabled={state?.status === "reading"}
                    onChange={(event) => {
                      const [file] = event.target.files ?? [];
                      event.target.value = "";
                      if (file) onUpload(key, file);
                    }}
                  />
                </label>
                {dataset && <button className="clear-upload-button" type="button" disabled={state?.status === "reading"} onClick={() => onClear(key)}>Remove</button>}
              </div>
            </article>
          );
        })}
      </div>
      <div className="csv-format-help">CSV headers are read from the first row. The viewer shows up to six preview rows and calculates risk statistics when a <code>risk</code> or <code>final_risk_log10_pc</code> column is present.</div>
    </section>
  );
}

function DatasetPage({ label, dataset, onNavigate }) {
  if (!dataset) {
    return (
      <section className="dataset-empty-state">
        <span className="help-intro-icon"><Icon name="download" size={20} /></span>
        <h2>No {label.toLowerCase()} uploaded</h2>
        <p>This dataset is not currently in the dashboard. The bundled original loads when the page starts; you can also select a replacement.</p>
        <button type="button" className="evaluator-submit" onClick={() => onNavigate("#upload")}>Upload data</button>
      </section>
    );
  }

  return (
    <section className="dataset-section">
      <div className="section-heading">
        <div><span className="panel-eyebrow">UPLOADED FILE</span><h2>{label}</h2></div>
        <span className="dataset-source-note">{dataset.fileName} · {formatBytes(dataset.size)}</span>
      </div>
      <div className="dataset-panel uploaded-dataset-panel">
        <div className="dataset-facts">
          <article><span>Data rows</span><strong>{dataset.rows.toLocaleString()}</strong><small>Valid-width rows</small></article>
          <article><span>Columns</span><strong>{dataset.columns.toLocaleString()}</strong><small>From uploaded CSV</small></article>
          <article><span>Rows skipped</span><strong>{dataset.invalidRows.toLocaleString()}</strong><small>Column count mismatch</small></article>
          <article><span>Risk values</span><strong>{dataset.risk?.count.toLocaleString() ?? "—"}</strong><small>{dataset.risk ? "Finite numeric values" : "No risk column found"}</small></article>
        </div>
        {dataset.risk && (
          <div className="uploaded-risk-stats">
            <span>Risk range <strong>{formatRaw(dataset.risk.min)} to {formatRaw(dataset.risk.max)}</strong></span>
            <span>Risk mean <strong>{formatRaw(dataset.risk.mean)}</strong></span>
          </div>
        )}
        <div className="uploaded-preview-heading"><strong>First {dataset.previewRows.length} data rows</strong><span>Preview only · original file is unchanged</span></div>
        <div className="dataset-table-wrap">
          <table className="dataset-table uploaded-preview-table">
            <thead><tr>{dataset.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
            <tbody>{dataset.previewRows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || "—"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function formatCollisionProbability(probability) {
  if (!Number.isFinite(probability)) return "—";
  const percent = probability * 100;
  if (percent <= 0) return "0%";
  if (percent >= 0.01) return `${percent.toFixed(2)}%`;
  const digits = Math.min(Math.ceil(-Math.log10(percent)) + 2, 14);
  return `${percent.toFixed(digits)}%`;
}

function EncounterDashboard({ datasets, selectedSplit, setSelectedSplit, selectedEventId, setSelectedEventId }) {
  const activeSplit = datasets[selectedSplit] ? selectedSplit : datasets.train ? "train" : "test";
  const dataset = datasets[activeSplit];
  const rankedEncounters = dataset?.topEncounters ?? [];
  const encounter = rankedEncounters.find((item) => item.eventId === selectedEventId) ?? rankedEncounters[0];
  const encounterRank = rankedEncounters.indexOf(encounter) + 1;
  const trajectory = encounter?.trajectory ?? [];
  const chart = { width: 620, height: 270, left: 52, right: 598, top: 24, bottom: 220 };
  const closestObservation = encounter ? {
    relativeT: encounter.closestRelativeT,
    relativeN: encounter.closestRelativeN,
  } : null;
  const extentPoints = closestObservation &&
    Number.isFinite(closestObservation.relativeT) &&
    Number.isFinite(closestObservation.relativeN)
    ? [...trajectory, closestObservation]
    : trajectory;
  const tValues = extentPoints.map((point) => point.relativeT);
  const nValues = extentPoints.map((point) => point.relativeN);
  const tMin = Math.min(...tValues);
  const tMax = Math.max(...tValues);
  const nMin = Math.min(...nValues);
  const nMax = Math.max(...nValues);
  const tRange = tMax - tMin || 1;
  const nRange = nMax - nMin || 1;
  const chartPoints = trajectory.map((point) => ({
    ...point,
    x: chart.left + ((point.relativeT - tMin) / tRange) * (chart.right - chart.left),
    y: chart.bottom - ((point.relativeN - nMin) / nRange) * (chart.bottom - chart.top),
  }));
  const closestPoint = closestObservation &&
    Number.isFinite(closestObservation.relativeT) &&
    Number.isFinite(closestObservation.relativeN)
    ? {
        x: chart.left + ((closestObservation.relativeT - tMin) / tRange) * (chart.right - chart.left),
        y: chart.bottom - ((closestObservation.relativeN - nMin) / nRange) * (chart.bottom - chart.top),
      }
    : null;
  const closestEncounter = dataset?.closestEncounter;

  return (
    <section className="encounter-dashboard">
      <header className="encounter-dashboard-heading">
        <div>
          <span className="panel-eyebrow">OBSERVED CSV TELEMETRY · NOT A PREDICTION</span>
          <h2>Relative encounter trajectory</h2>
        </div>
        <div className="encounter-split-tabs" role="group" aria-label="Select trajectory dataset">
          {["train", "test"].map((split) => (
            <button
              type="button"
              key={split}
              className={activeSplit === split ? "selected" : ""}
              aria-pressed={selectedSplit === split}
              disabled={!datasets[split]}
              onClick={() => { setSelectedSplit(split); setSelectedEventId(null); }}
            >
              {split === "train" ? "Training" : "Test"}
            </button>
          ))}
        </div>
      </header>
      {encounter ? (
        <div className="encounter-dashboard-body">
          <div className="encounter-trajectory">
            <div className="encounter-chart-caption">
              <span>Event {encounter.eventId} · relative position plane</span>
              <span>{trajectory.length} observed positions</span>
            </div>
            {chartPoints.length > 1 ? (
              <div className="encounter-chart-scroll">
                <svg className="encounter-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`Observed relative trajectory for event ${encounter.eventId}`}>
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const x = chart.left + fraction * (chart.right - chart.left);
                    const y = chart.bottom - fraction * (chart.bottom - chart.top);
                    return (
                      <g className="encounter-grid" key={fraction}>
                        <line x1={x} y1={chart.top} x2={x} y2={chart.bottom} />
                        <line x1={chart.left} y1={y} x2={chart.right} y2={y} />
                        <text x={x} y={chart.bottom + 18} textAnchor="middle">{formatRaw((tMin + tRange * fraction) / 1000)}</text>
                        <text x={chart.left - 8} y={y + 3} textAnchor="end">{formatRaw((nMin + nRange * fraction) / 1000)}</text>
                      </g>
                    );
                  })}
                  <line className="encounter-axis" x1={chart.left} y1={chart.bottom} x2={chart.right} y2={chart.bottom} />
                  <line className="encounter-axis" x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.bottom} />
                  <polyline className="encounter-path" points={chartPoints.map(({ x, y }) => `${x},${y}`).join(" ")} />
                  {chartPoints.map((point, index) => (
                    <circle
                      className="encounter-point"
                      key={`${point.timeToTcaDays}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="3.2"
                    >
                      <title>{`TCA ${formatRaw(point.timeToTcaDays)} days · miss ${formatRaw(point.missDistanceMeters)} m`}</title>
                    </circle>
                  ))}
                  {closestPoint && (
                    <circle className="encounter-point closest" cx={closestPoint.x} cy={closestPoint.y} r="6">
                      <title>Closest recorded approach · {formatRaw(encounter.minMissDistanceMeters)} m</title>
                    </circle>
                  )}
                  <text className="encounter-axis-label" x={(chart.left + chart.right) / 2} y="262" textAnchor="middle">Along-track position (km)</text>
                  <text className="encounter-axis-label" transform={`translate(14 ${(chart.top + chart.bottom) / 2}) rotate(-90)`} textAnchor="middle">Cross-track position (km)</text>
                </svg>
              </div>
            ) : (
              <div className="encounter-no-track">Relative-position columns are unavailable for this file.</div>
            )}
            <div className="encounter-chart-legend">
              <span><i className="trajectory-legend-line" /> Observed relative trajectory</span>
              <span><i className="trajectory-legend-point" /> Closest recorded approach</span>
            </div>
          </div>
          <aside className="encounter-score-panel">
            <div className="encounter-event-label">{dataset?.ranking === "official-tier" ? `OFFICIAL RANK #${encounterRank}` : encounterRank === 1 ? "HIGHEST RECORDED RISK" : `RISK RANK #${encounterRank}`}</div>
            <div className="encounter-pick-row">
              <strong className="encounter-event-id">Event {encounter.eventId}</strong>
              {encounter.label && (
                <span className={`tier-badge tier-${encounter.label.tier.toLowerCase()}`}>{encounter.label.tier}</span>
              )}
            </div>
            <div className="encounter-score">
              <span>Peak collision probability</span>
              <strong>{formatCollisionProbability(encounter.peakCollisionProbability)}</strong>
              <small>from max observed log10(Pc) {formatRaw(encounter.peakRiskLog10Pc)}</small>
            </div>
            <div className="encounter-score">
              <span>Closest recorded miss</span>
              <strong>{formatRaw(encounter.minMissDistanceMeters)} <small>m</small></strong>
              {Number.isFinite(encounter.closestTimeToTcaDays) && (
                <small>{formatRaw(encounter.closestTimeToTcaDays * 24)} h to TCA</small>
              )}
            </div>
            {encounter.label && (
              <p className="encounter-final-note">
                Official final message: {formatRaw(encounter.label.finalMissDistanceMeters)} m miss · log10(Pc) {formatRaw(encounter.label.finalRiskLog10Pc)} · {formatRaw(encounter.label.finalTimeToTcaDays)} d to TCA
              </p>
            )}
            {Number.isFinite(encounter.relativeSpeedMetersPerSecond) && (
              <div className="encounter-score compact">
                <span>Relative speed</span>
                <strong>{formatRaw(encounter.relativeSpeedMetersPerSecond / 1000)} <small>km/s</small></strong>
              </div>
            )}
            {closestEncounter && (
              <p className="closest-event-note">
                Dataset closest approach: Event {closestEncounter.eventId} · {formatRaw(closestEncounter.minMissDistanceMeters)} m
              </p>
            )}
                      <nav className="encounter-rank-nav" aria-label="Browse ranked events">
              <button type="button" disabled={encounterRank <= 1} onClick={() => setSelectedEventId(rankedEncounters[encounterRank - 2].eventId)}>← Previous</button>
              <span>{encounterRank} of {rankedEncounters.length}</span>
              <button type="button" disabled={encounterRank >= rankedEncounters.length} onClick={() => setSelectedEventId(rankedEncounters[encounterRank].eventId)}>Next →</button>
            </nav>
          </aside>
        </div>
      ) : (
        <div className="encounter-no-track">
          This CSV has no supported event, risk, miss-distance, and relative-position columns for a trajectory view.
        </div>
      )}
      <p className="encounter-data-note">
        Visualization uses observed <code>relative_position_t</code> and <code>relative_position_n</code> values (km). Pc is calculated as <code>10^risk</code>; miss distance is the minimum recorded value for the event. These are dataset observations, not live orbit predictions or maneuver guidance.
      </p>
    </section>
  );
}

function DatasetAnalytics({ datasets, onNavigate }) {
  const uploaded = Object.entries(datasets).filter(([, dataset]) => dataset);
  if (uploaded.length === 0) {
    return <DatasetPage label="Dataset analysis" dataset={null} onNavigate={onNavigate} />;
  }

  return (
    <section className="dataset-section">
      <div className="section-heading">
        <div><span className="panel-eyebrow">UPLOADED FILES ONLY</span><h2>Dataset analysis</h2></div>
      </div>
      <div className="uploaded-analysis-grid">
        {uploaded.map(([split, dataset]) => (
          <article className="uploaded-analysis-card" key={split}>
            <span>{split === "train" ? "TRAINING" : "TEST"}</span>
            <strong>{dataset.rows.toLocaleString()}</strong>
            <small>rows · {dataset.columns} columns</small>
            <p>{dataset.fileName} · {formatBytes(dataset.size)}</p>
            {dataset.risk && <p>Risk min / mean / max: {formatRaw(dataset.risk.min)} / {formatRaw(dataset.risk.mean)} / {formatRaw(dataset.risk.max)}</p>}
            <button type="button" className="help-open-link" onClick={() => onNavigate(split === "train" ? "#training" : "#test")}>View uploaded rows<Icon name="arrow" size={14} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ModelEvaluation({ datasets, onNavigate }) {
  const ready = Boolean(datasets.train && datasets.test);
  return (
    <section className="model-section">
      <div className="section-heading">
        <div><span className="panel-eyebrow">MODEL STATUS</span><h2>Model evaluation</h2></div>
      </div>
      <div className="model-panel uploaded-model-panel">
        <div className="model-status-icon"><Icon name={ready ? "shield" : "download"} size={22} /></div>
        <div>
          <strong>{ready ? "Training and test files are ready" : "Upload your training and test files"}</strong>
          <p>{ready
            ? "Both files are available for inspection. This website displays uploaded data but does not train a model or generate predictions."
            : "No model metrics or predictions are provided. The bundled CSVs load automatically for inspection."}</p>
          <div className="model-file-readiness">
            <span className={datasets.train ? "ready" : ""}>Training file {datasets.train ? `· ${datasets.train.rows.toLocaleString()} rows` : "· not uploaded"}</span>
            <span className={datasets.test ? "ready" : ""}>Test file {datasets.test ? `· ${datasets.test.rows.toLocaleString()} rows` : "· not uploaded"}</span>
          </div>
        </div>
        {!ready && <button type="button" className="evaluator-submit" onClick={() => onNavigate("#upload")}>Upload data</button>}
      </div>
    </section>
  );
}

function Analytics({ datasets, onNavigate }) {
  return <DatasetAnalytics datasets={datasets} onNavigate={onNavigate} />;
}

function HelpGuide({ onNavigate }) {
  const guides = [
    {
      href: "#overview",
      icon: "grid",
      title: "Overview",
      purpose: "Shows the highest recorded risk, miss distance, and relative trajectory from the bundled training and test CSVs.",
      steps: ["Switch between training and test to inspect each split's highest-risk event.", "Compare the peak observed Pc, closest recorded miss, and position trace; these are telemetry, not predictions."],
    },
    {
      href: "#upload",
      icon: "download",
      title: "Upload data",
      purpose: "Shows the automatically loaded datasets and lets you replace either CSV.",
      steps: ["The bundled files are loaded when the app starts.", "Choose a replacement or remove the current dataset; refresh restores the bundled file."],
    },
    {
      href: "#training",
      icon: "chart",
      title: "Training data",
      purpose: "Shows basic statistics and a small preview of the bundled or replacement training CSV.",
      steps: ["The bundled training CSV loads automatically.", "Use Upload data to replace it; only its summary and preview are displayed."],
    },
    {
      href: "#test",
      icon: "chart",
      title: "Test data",
      purpose: "Shows basic statistics and a small preview of the bundled or replacement test CSV.",
      steps: ["The bundled test CSV loads automatically.", "Risk statistics appear only if the file has a numeric risk column."],
    },
    {
      href: "#datasets",
      icon: "chart",
      title: "Dataset analysis",
      purpose: "Compares the loaded files by row count, column count and risk summary.",
      steps: ["Both bundled files load automatically.", "Open a file's detailed view to inspect its columns and preview rows."],
    },
    {
      href: "#model",
      icon: "chart",
      title: "Model evaluation",
      purpose: "Shows whether the bundled files are available. This website does not train a model or create predictions.",
      steps: ["Both files load automatically and are available for inspection.", "No accuracy scores are shown because model evaluation is not implemented."],
    },
    {
      href: "#analytics",
      icon: "chart",
      title: "Analytics",
      purpose: "Summarizes the training and test files currently loaded.",
      steps: ["Review the counts and risk statistics for each file.", "Removing a file clears it for this session; refresh restores the bundled original."],
    },
  ];

  return (
    <section className="help-page" aria-labelledby="help-title">
      <div className="section-heading help-heading">
        <div><span className="panel-eyebrow">NEW TO ORBITAL?</span><h2 id="help-title">A guide to the dashboard</h2></div>
      </div>
      <div className="help-intro">
        <span className="help-intro-icon"><Icon name="help" size={20} /></span>
        <div>
          <strong>Upload your own data to get started</strong>
          <p>The real training and test CSVs are bundled with the app and loaded automatically. Parsing and summaries happen locally in your browser.</p>
        </div>
      </div>
      <div className="help-grid">
        {guides.map((guide) => (
          <article className="help-card" key={guide.href}>
            <div className="help-card-heading"><span><Icon name={guide.icon} size={17} /></span><h3>{guide.title}</h3></div>
            <p>{guide.purpose}</p>
            <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <button type="button" className="help-open-link" onClick={() => onNavigate(guide.href)}>
              Open {guide.title}<Icon name="arrow" size={14} />
            </button>
          </article>
        ))}
      </div>
      <aside className="help-safety-note">
        <Icon name="shield" size={17} />
        <p><strong>Privacy:</strong> The bundled CSVs and any replacements are processed locally in this browser. Removing a bundled dataset clears the current view; refreshing restores the bundled original files.</p>
      </aside>
    </section>
  );
}

function App() {
  const [datasets, setDatasets] = useState({ train: null, test: null });
  const [uploadStates, setUploadStates] = useState({ train: null, test: null });
  const [isLoadingBundledData, setIsLoadingBundledData] = useState(true);
  const [overviewSplit, setOverviewSplit] = useState("train");
  const [overviewEventId, setOverviewEventId] = useState(null);
  const labelsRef = useRef(null);
  const [activeHref, setActiveHref] = useState(() =>
    navigation.some((item) => item.href === window.location.hash)
      ? window.location.hash
      : "#overview",
  );
  const activeItem = navigation.find((item) => item.href === activeHref) ?? navigation[0];

  useEffect(() => {
    function syncActiveView() {
      setActiveHref(
        navigation.some((item) => item.href === window.location.hash)
          ? window.location.hash
          : "#overview",
      );
    }

    window.addEventListener("hashchange", syncActiveView);
    window.addEventListener("popstate", syncActiveView);
    return () => {
      window.removeEventListener("hashchange", syncActiveView);
      window.removeEventListener("popstate", syncActiveView);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const bundledDatasets = [
      { split: "train", url: "/data/train_data.csv" },
      { split: "test", url: "/data/test_data.csv" },
    ];

    setUploadStates((current) => ({
      ...current,
      train: { status: "reading", progress: 0, error: null },
      test: { status: "reading", progress: 0, error: null },
    }));

    async function loadBundledData() {
      let trainLabels = null;
      try {
        const labelResponse = await fetch("/data/train_event_labels.csv", { signal: controller.signal });
        if (labelResponse.ok) trainLabels = parseEventLabels(await labelResponse.text());
      } catch {
        trainLabels = null;
      }
      labelsRef.current = trainLabels;

      await Promise.all(bundledDatasets.map(async ({ split, url }) => {
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok || !response.body) {
            throw new Error(`Could not load ${split} data (${response.status}).`);
          }
          const size = Number(response.headers.get("content-length")) || 0;
          const dataset = await summarizeCsvStream({
            name: url.split("/").at(-1),
            size,
            stream: () => response.body,
          }, (progress) => {
            if (!controller.signal.aborted) {
              setUploadStates((current) => ({
                ...current,
                [split]: { status: "reading", progress, error: null },
              }));
            }
          }, split === "train" && trainLabels ? trainLabels : {});
          if (!controller.signal.aborted) {
            setDatasets((current) => ({ ...current, [split]: dataset }));
            setUploadStates((current) => ({ ...current, [split]: null }));
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setUploadStates((current) => ({
              ...current,
              [split]: {
                status: "error",
                progress: 0,
                error: error instanceof Error ? error.message : `Could not load ${split} data.`,
              },
            }));
          }
        }
      }));

      if (!controller.signal.aborted) setIsLoadingBundledData(false);
    }

    loadBundledData();
    return () => controller.abort();
  }, []);

  function navigate(href) {
    if (window.location.hash !== href) {
      window.history.pushState(null, "", href);
    }
    setActiveHref(href);
    window.scrollTo(0, 0);
  }

  async function uploadDataset(split, file) {
    setUploadStates((current) => ({
      ...current,
      [split]: { status: "reading", progress: 0, error: null },
    }));

    try {
      const dataset = await summarizeCsvFile(file, (progress) => {
        setUploadStates((current) => ({
          ...current,
          [split]: { status: "reading", progress, error: null },
        }));
      }, split === "train" && labelsRef.current ? labelsRef.current : {});
      setDatasets((current) => ({ ...current, [split]: dataset }));
      setUploadStates((current) => ({ ...current, [split]: null }));
    } catch (error) {
      setUploadStates((current) => ({
        ...current,
        [split]: {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "The CSV could not be read.",
        },
      }));
    }
  }

  function clearDataset(split) {
    setDatasets((current) => ({ ...current, [split]: null }));
    setUploadStates((current) => ({ ...current, [split]: null }));
  }

  const isOverview = activeHref === "#overview";
  const hasUploadedData = Boolean(datasets.train || datasets.test);

  return (
    <div className="app-shell">
      <Sidebar activeHref={activeHref} onNavigate={navigate} />
      <main className="main-content">
        <Topbar activeLabel={activeItem.label} />
        <div className={`dashboard-content ${isOverview ? "dashboard-overview" : "dashboard-detail"}`}>
          {isOverview ? (
            <>
              <section className="page-heading">
                <div><div className="greeting">LOCAL CSV WORKSPACE <span className="greeting-dot" /> YOUR DATA ONLY</div><h1>Training &amp; test data</h1><p>Your training and test files load automatically; replace them any time.</p></div>
                <button type="button" className="export-button" onClick={() => navigate("#upload")}><Icon name="plus" size={16} /> Upload data</button>
              </section>
              {!isLoadingBundledData && Object.values(uploadStates).some((state) => state?.error) && (
                <p className="bundled-data-error overview-load-error" role="alert">
                  {Object.values(uploadStates).find((state) => state?.error)?.error}
                  {" "}Open Upload data to retry or choose another CSV.
                </p>
              )}
              {hasUploadedData ? (
                <>
                  <section className="metrics-grid" aria-label="Uploaded dataset summary">
                    <MetricCard label="Training encounters" value={datasets.train?.encounterCount?.toLocaleString() ?? "—"} detail={datasets.train?.fileName ?? "Not loaded"} icon="orbit" tone="blue" />
                    <MetricCard label="Training peak Pc" value={formatCollisionProbability(datasets.train?.peakEncounter?.peakCollisionProbability)} detail={datasets.train ? `Event ${datasets.train.peakEncounter?.eventId ?? "—"}` : "Not loaded"} icon="crosshair" tone="amber" />
                    <MetricCard label="Test encounters" value={datasets.test?.encounterCount?.toLocaleString() ?? "—"} detail={datasets.test?.fileName ?? "Not loaded"} icon="orbit" tone="teal" />
                    <MetricCard label="Test peak Pc" value={formatCollisionProbability(datasets.test?.peakEncounter?.peakCollisionProbability)} detail={datasets.test ? `Event ${datasets.test.peakEncounter?.eventId ?? "—"}` : "Not loaded"} icon="crosshair" tone="green" />
                  </section>
                  <div className="overview-data-row">
                    <EncounterDashboard datasets={datasets} selectedSplit={overviewSplit} setSelectedSplit={setOverviewSplit} selectedEventId={overviewEventId} setSelectedEventId={setOverviewEventId} />
                    <OrbitGeometryView encounter={(() => {
                      const ranked = datasets[datasets[overviewSplit] ? overviewSplit : datasets.train ? "train" : "test"]?.topEncounters ?? [];
                      return ranked.find((item) => item.eventId === overviewEventId) ?? ranked[0];
                    })()} />
                  </div>
                </>
              ) : isLoadingBundledData ? (
                <section className="overview-loading-state" role="status">
                  <div className="overview-loading-copy">
                    <span className="overview-empty-icon"><Icon name="orbit" size={25} /></span>
                    <h2>Loading your datasets</h2>
                    <p>Your training and test files are being read locally. Large files may take a moment.</p>
                    <div className="overview-loading-progress">
                      {["train", "test"].map((split) => (
                        <div key={split}>
                          <span>{split === "train" ? "Training data" : "Test data"}</span>
                          <progress max="1" value={uploadStates[split]?.progress ?? 0} />
                          <small>{Math.round((uploadStates[split]?.progress ?? 0) * 100)}%</small>
                        </div>
                      ))}
                    </div>
                    {Object.values(uploadStates).some((state) => state?.error) && (
                      <p className="bundled-data-error" role="alert">
                        {Object.values(uploadStates).find((state) => state?.error)?.error}
                        {" "}Use Upload data to retry with your CSV files.
                      </p>
                    )}
                  </div>
                  <EarthOrbitIllustration />
                </section>
              ) : (
                <section className="overview-empty-state">
                  <div className="overview-empty-copy">
                    <span className="overview-empty-icon"><Icon name="download" size={25} /></span>
                    <h2>No data uploaded</h2>
                    <p>The bundled CSVs could not be loaded. Choose files manually or try refreshing the app.</p>
                    <button type="button" className="evaluator-submit" onClick={() => navigate("#upload")}>Choose your files</button>
                    <small>Large CSV files are processed locally in your browser.</small>
                  </div>
                  <EarthOrbitIllustration />
                </section>
              )}
            </>
          ) : (
            <>
              {activeHref === "#upload" && <DatasetUpload datasets={datasets} uploadStates={uploadStates} onUpload={uploadDataset} onClear={clearDataset} />}
              {activeHref === "#training" && <DatasetPage label="Training data" dataset={datasets.train} onNavigate={navigate} />}
              {activeHref === "#test" && <DatasetPage label="Test data" dataset={datasets.test} onNavigate={navigate} />}
              {activeHref === "#datasets" && <DatasetAnalytics datasets={datasets} onNavigate={navigate} />}
              {activeHref === "#model" && <ModelEvaluation datasets={datasets} onNavigate={navigate} />}
              {activeHref === "#analytics" && <Analytics datasets={datasets} onNavigate={navigate} />}
              {activeHref === "#help" && <HelpGuide onNavigate={navigate} />}
              <footer className="dashboard-footer"><span>CSV data is processed locally in this browser.</span><a href="#overview" onClick={(event) => { event.preventDefault(); navigate("#overview"); }}>Back to overview</a></footer>
            </>
          )}
        </div>
      </main>
      <div className="search-bridge" aria-hidden="true" />
    </div>
  );
}

export default App;
