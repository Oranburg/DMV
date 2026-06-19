import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- helpers ---------- */

function getByPath(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function currency(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function unitAllIn(unit) {
  const p = unit.pricing || {};
  const utils = p.utilities || {};
  const utilTotal = Object.values(utils).reduce((s, v) => s + (Number(v) || 0), 0);
  return (Number(p.baseRent) || 0) + (Number(p.parking) || 0) + (Number(p.mandatoryFees) || 0) + utilTotal;
}

// tri-state: true => met, null/undefined => unverified (passes, flagged), false => fails
function triState(value) {
  if (value === true) return "met";
  if (value === false) return "fail";
  return "unverified";
}

function spaceState(unit) {
  if (unit.bedrooms >= 2 || unit.den === true) return "met";
  if (unit.den === false && unit.bedrooms < 2) return "fail";
  return "unverified";
}

// per-unit state for a unit-level feature factor
function unitFactorState(factor, unit) {
  if (factor.rule === "spaceFloor") return spaceState(unit);
  return triState(getByPath(unit, factor.path));
}

/* ---------- distances (honest: only real data, never guessed) ---------- */

const ANCHOR_COORDS = {
  synagogue: [39.0407, -77.0205], // Kemp Mill Synagogue area (public landmark)
  berman: [39.0739, -77.1196], // Berman Hebrew Academy, Rockville (public landmark)
};

function distanceFor(building, anchorKey, mode) {
  const d = building.distances && building.distances[anchorKey];
  if (d && typeof d[mode] === "number") return d[mode];
  if (anchorKey === "metro" && mode === "walk" && typeof building.walkToMetroMin === "number") return building.walkToMetroMin;
  if (anchorKey === "synagogue" && mode === "drive" && typeof building.familyDriveMin === "number") return building.familyDriveMin;
  return null;
}

/* ---------- scoring ---------- */

function scalarSub(rule, building, unit, S) {
  const lin = (val, best, worst) => (val == null ? null : clamp01((worst - val) / (worst - best)));
  const linUp = (val, floor, ceil) => (val == null ? null : clamp01((val - floor) / (ceil - floor)));
  switch (rule) {
    case "cost":
      return clamp01((S.costCeiling - unitAllIn(unit)) / (S.costCeiling - S.costFloor));
    case "metroWalk":
      return lin(distanceFor(building, "metro", "walk"), S.metroWalkBest, S.metroWalkWorst);
    case "quiet": {
      const n = building.building && building.building.noise;
      return n == null ? null : clamp01((n - S.quietWorst) / (S.quietBest - S.quietWorst));
    }
    case "distanceSynagogue":
      return lin(distanceFor(building, "synagogue", "drive"), S.synagogueDriveBest, S.synagogueDriveWorst);
    case "distanceBerman":
      return lin(distanceFor(building, "berman", "drive"), S.bermanDriveBest, S.bermanDriveWorst);
    case "squareFeet":
      return linUp(unit.squareFeet, S.squareFeetFloor, S.squareFeetCeiling);
    case "bathrooms":
      // 1 bath => 0, 1.5 => 0.5, 2+ => 1 (Penny is open to 1 bath, prefers a second)
      return unit.bathrooms == null ? null : clamp01((unit.bathrooms - 1) / 1);
    default:
      return null;
  }
}

function featureSubForBuilding(factor, building, unit) {
  // returns 1 / 0 / 0.5(neutral) for a feature factor
  let st;
  if (factor.level === "unit") st = unit ? unitFactorState(factor, unit) : "unverified";
  else st = triState(getByPath(building, factor.path));
  return st === "met" ? 1 : st === "fail" ? 0 : 0.5;
}

function activeMustFeatures(factors, state) {
  return factors.filter((f) => f.kind === "feature" && state[f.key] && state[f.key].on && state[f.key].must);
}

function unitPassesMusts(unit, mustUnitFactors) {
  return mustUnitFactors.every((f) => unitFactorState(f, unit) !== "fail");
}

function bestQualifyingUnit(building, mustUnitFactors) {
  const ok = (building.units || []).filter((u) => unitPassesMusts(u, mustUnitFactors));
  if (!ok.length) return null;
  return ok.slice().sort((a, b) => unitAllIn(a) - unitAllIn(b))[0];
}

function buildingPasses(building, factors, state, typeSet) {
  if (building.buildingType && typeSet.size && !typeSet.has(building.buildingType)) return false;
  const musts = activeMustFeatures(factors, state);
  const buildingMust = musts.filter((f) => f.level !== "unit");
  if (!buildingMust.every((f) => triState(getByPath(building, f.path)) !== "fail")) return false;
  const unitMust = musts.filter((f) => f.level === "unit");
  return bestQualifyingUnit(building, unitMust) != null;
}

function scoreBuilding(building, unit, factors, state, S) {
  let weighted = 0;
  let total = 0;
  for (const f of factors) {
    const st = state[f.key];
    if (!st || !st.on || st.must) continue; // must-features filter, they do not rank
    const w = st.weight;
    if (!w) continue;
    let sub;
    if (f.kind === "feature") sub = featureSubForBuilding(f, building, unit);
    else {
      sub = scalarSub(f.rule, building, unit, S);
      if (sub == null) sub = 0.5;
    }
    weighted += sub * w;
    total += w;
  }
  if (total === 0) return 0;
  return Math.round((weighted / total) * 100);
}

/* ---------- atoms ---------- */

function Check({ ok }) {
  return (
    <svg className="mh-check" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {ok ? (
        <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2.5 2.5" />
      )}
    </svg>
  );
}

function PhotoFallback({ name }) {
  return (
    <div className="photo-fallback" role="img" aria-label={`No photo available for ${name}`}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M4 12h16" />
      </svg>
      <span className="fb-name">{name}</span>
    </div>
  );
}

/* ---------- walk score block ---------- */

function ScoreBadge({ label, value }) {
  if (value == null) return null;
  const tier = value >= 90 ? "high" : value >= 70 ? "good" : value >= 50 ? "ok" : "low";
  return (
    <span className={`score-badge tier-${tier}`}>
      <span className="sb-num tnum">{value}</span>
      <span className="sb-label">{label}</span>
    </span>
  );
}

function WalkScores({ building }) {
  const s = building.scores || {};
  if (s.walk == null && s.transit == null && s.bike == null) {
    return <div className="walkscore-pending">Walk Score pending (added when the address is scored).</div>;
  }
  return (
    <div className="walkscore-row">
      <ScoreBadge label="Walk" value={s.walk} />
      <ScoreBadge label="Transit" value={s.transit} />
      <ScoreBadge label="Bike" value={s.bike} />
      {s.wsLink && (
        <a className="walkscore-link" href={s.wsLink} target="_blank" rel="noopener">
          What's nearby →
        </a>
      )}
    </div>
  );
}

/* ---------- distance card ---------- */

function DistanceCard({ building, locations, mode }) {
  return (
    <div className="distance-card">
      {locations.map((loc) => {
        const mins = distanceFor(building, loc.key, mode);
        const measured = typeof mins === "number";
        return (
          <div className="distance-row" key={loc.key}>
            <span className="dest">{loc.label}</span>
            {measured ? (
              <span className="val tnum">{mins} min {mode}</span>
            ) : (
              <span className="val missing">not yet measured</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- map ---------- */

function MapBox({ building, locations }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const coords = building.coords;

  useEffect(() => {
    if (!coords || !ref.current) return;
    let cancelled = false;
    let map;
    async function load() {
      try {
        if (!window.L) {
          await new Promise((resolve, reject) => {
            const css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(css);
            const sc = document.createElement("script");
            sc.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
            sc.onload = resolve;
            sc.onerror = reject;
            document.head.appendChild(sc);
            setTimeout(reject, 6000);
          });
        }
        if (cancelled || !ref.current) return;
        const L = window.L;
        map = L.map(ref.current, { scrollWheelZoom: false }).setView(coords, 14);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
        const pin = (color, glyph) =>
          L.divIcon({
            className: "",
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px">${glyph || ""}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
        L.marker(coords, { title: building.name, icon: pin("#1a5462", "•") }).addTo(map);
        for (const loc of locations) {
          const c = loc.key === "metro" ? building.metroCoords : ANCHOR_COORDS[loc.key];
          if (!c) continue;
          const color = loc.key === "synagogue" ? "#b8860b" : loc.key === "berman" ? "#7a4b6b" : "#3d5a80";
          L.marker(c, { title: loc.label, icon: pin(color, loc.key === "metro" ? "M" : "") }).addTo(map);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [coords, building, locations]);

  if (!coords || failed) {
    return (
      <div className="map-box">
        <div className="map-fallback">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          <span>Map appears once the address is mapped. Distances are listed above.</span>
        </div>
      </div>
    );
  }
  return <div className="map-box" ref={ref} aria-label={`Map of ${building.name} and nearby landmarks`} />;
}

/* ---------- unit row ---------- */

function UnitRow({ unit }) {
  const beds = unit.bedrooms >= 2 ? `${unit.bedrooms} BR` : unit.den ? "1 BR + den" : `${unit.bedrooms} BR`;
  const balcony = triState(unit.balcony);
  const laundry = triState(unit.inUnitLaundry);
  const verified = balcony === "met" && laundry === "met";
  return (
    <div className="unit-row">
      <div className="unit-toprow">
        <span className="unit-label">{unit.label || "Unit"}</span>
        <span className="unit-rent tnum">{currency(unitAllIn(unit))} / mo</span>
      </div>
      <div className="unit-spec">
        {beds}
        {unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString()} sq ft` : ""}
      </div>
      <div className="badge-row">
        <span className="badge feature">{balcony === "fail" ? "No balcony" : "Balcony"}</span>
        <span className="badge feature">{laundry === "fail" ? "No in-unit laundry" : "In-unit laundry"}</span>
        {verified ? <span className="badge verified">Verified</span> : <span className="badge confirm">Needs confirmation</span>}
      </div>
    </div>
  );
}

/* ---------- building card ---------- */

const TYPE_LABEL = { apartment: "Apartment", condo: "Condo" };

function BuildingCard({ entry, rank, mustFeatures, locations, mode, expanded, onToggle, onFeedback }) {
  const { building, score, bestUnit } = entry;
  const photos = building.photos || [];
  const qualifying = entry.qualifyingUnits;
  const allIns = qualifying.map(unitAllIn).filter((n) => n > 0);
  const lo = allIns.length ? Math.min(...allIns) : null;
  const hi = allIns.length ? Math.max(...allIns) : null;
  const rentLabel = lo == null ? "Price on request" : lo === hi ? `${currency(lo)} / month` : `${currency(lo)} to ${currency(hi)} / month`;

  const grid = mustFeatures.map((f) => {
    let st;
    if (f.level === "unit") st = qualifying.some((u) => unitFactorState(f, u) === "met") ? "met" : "unverified";
    else st = triState(getByPath(building, f.path));
    return { key: f.key, label: f.label, st };
  });

  return (
    <article className="card">
      <div className="card-photo-wrap">
        {photos.length ? (
          <img className="card-photo" src={photos[0]} alt={`Exterior of ${building.name}`} loading={rank === 1 ? "eager" : "lazy"} decoding="async" />
        ) : (
          <PhotoFallback name={building.name} />
        )}
        {rank > 1 && <span className="rank-chip" aria-hidden="true">{rank}</span>}
        {building.buildingType && <span className="type-chip">{TYPE_LABEL[building.buildingType] || building.buildingType}</span>}
      </div>

      <div className="card-body">
        <div className="card-toprow">
          {rank === 1 && <span className="best-fit">Best fit</span>}
          <span className="score">Score {score}</span>
        </div>

        <h2 className="building-name">{building.name}</h2>
        <div className="rent-range tnum">{rentLabel}</div>

        <WalkScores building={building} />

        {grid.length > 0 && (
          <div className="musthave-grid">
            {grid.map((m) => (
              <span className={`mh-item ${m.st === "met" ? "" : "unverified"}`} key={m.key}>
                <Check ok={m.st === "met"} />
                {m.label}
                {m.st !== "met" ? " (verify)" : ""}
              </span>
            ))}
          </div>
        )}

        <DistanceCard building={building} locations={locations} mode={mode} />

        {expanded && (
          <>
            <MapBox building={building} locations={locations} />
            <div className="units-head">Available units</div>
            {qualifying.length ? qualifying.map((u, i) => <UnitRow key={u.id || i} unit={u} />) : <div className="unit-spec">No qualifying units logged yet.</div>}
            <div className="card-actions">
              {building.phone && (
                <a className="call-link" href={`tel:${String(building.phone).replace(/[^0-9+]/g, "")}`}>
                  Call {building.phone}
                </a>
              )}
              {building.leasingUrl && (
                <a className="leasing-link" href={building.leasingUrl} target="_blank" rel="noopener">
                  View live availability →
                </a>
              )}
              <button className="feedback-inline" type="button" onClick={onFeedback}>
                Log what you learned →
              </button>
            </div>
          </>
        )}

        <button className="expand-row" aria-expanded={expanded} onClick={onToggle}>
          <span className="units-summary">
            {qualifying.length} unit{qualifying.length === 1 ? "" : "s"} to consider
          </span>
          <span>{expanded ? "Hide details ▴" : "View ▾"}</span>
        </button>
      </div>
    </article>
  );
}

/* ---------- refine ---------- */

function Switch({ checked, onChange, label }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-checked={checked} aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span className="knob" aria-hidden="true" />
    </span>
  );
}

function FactorRow({ factor, state, onChange }) {
  const isFeature = factor.kind === "feature";
  const max = isFeature ? 101 : 100;
  const sv = state.must ? 101 : state.weight;
  const weightText = state.must ? "Must have" : String(state.weight);

  function onSlide(v) {
    if (isFeature && v > 100) onChange({ must: true });
    else onChange({ must: false, weight: v });
  }

  return (
    <div className="pref-row">
      <div className="pref-top">
        <Switch checked={state.on} onChange={(on) => onChange({ on })} label={`${factor.label}, ${state.on ? "on" : "off"}`} />
        <span className="pref-name">{factor.label}</span>
        {state.on && state.must && <span className="must-tag">Must have</span>}
      </div>
      {state.on && (
        <div className="pref-slider-wrap">
          <input
            className={`pref-slider ${state.must ? "is-must" : ""}`}
            type="range"
            min="0"
            max={String(max)}
            step="1"
            value={sv}
            aria-label={`Importance of ${factor.label}`}
            aria-valuetext={state.must ? "Must have, always required" : `${state.weight} out of 100`}
            onChange={(e) => onSlide(Number(e.target.value))}
          />
          <span className="pref-weight tnum" aria-hidden="true">{weightText}</span>
        </div>
      )}
      {isFeature && state.on && !state.must && <p className="pref-hint">Slide fully right to require it.</p>}
    </div>
  );
}

function RefineSheet({ config, factorState, setFactorState, typeState, setTypeState, count, onClose }) {
  const text = config.appText || {};
  const factors = config.factors || [];
  const types = (config.buildingTypes && config.buildingTypes.options) || [];

  function setFactor(key, patch) {
    setFactorState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Refine results">
      <div className="sheet-scroll">
        <div className="sheet-topbar">
          <button className="sheet-x" onClick={onClose} aria-label="Close refine">✕</button>
          <button className="sheet-done" onClick={onClose}>Done</button>
        </div>
        <h1 className="sheet-title">Refine</h1>
        <p className="match-count" aria-live="polite">{count} building{count === 1 ? "" : "s"} match</p>

        <hr className="divider" />
        <div className="sheet-section-label">{text.buildingTypeHeading || "Building type"}</div>
        <p className="sheet-help">{text.buildingTypeHelp}</p>
        {types.map((t) => (
          <div className="pref-row" key={t.key}>
            <div className="pref-top">
              <Switch checked={typeState.has(t.key)} onChange={(on) => setTypeState((prev) => { const n = new Set(prev); if (on) n.add(t.key); else n.delete(t.key); return n; })} label={`${t.label}, ${typeState.has(t.key) ? "shown" : "hidden"}`} />
              <span className="pref-name">{t.label}</span>
            </div>
          </div>
        ))}

        <hr className="divider" />
        <div className="sheet-section-label">{text.factorsHeading || "What matters to you"}</div>
        <p className="sheet-help">{text.factorsHelp}</p>
        {factors.map((f) => (
          <FactorRow key={f.key} factor={f} state={factorState[f.key]} onChange={(patch) => setFactor(f.key, patch)} />
        ))}
      </div>
      <div className="sheet-footer">
        <button className="show-btn" onClick={onClose}>Show {count} building{count === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

/* ---------- feedback form (Web3Forms, same service as oranburg.law) ---------- */

const WEB3FORMS_KEY = "1f621cd8-66ab-4b92-9f3c-1b3805e67a52";

function FeedbackSheet({ place, onClose }) {
  const [status, setStatus] = useState("idle");
  const [form, setForm] = useState({ place: place || "", learned: "", prefs: "", contact: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          from_name: "Penny's Apartment Finder",
          subject: `Apartment note: ${form.place || "a place"}`,
          place: form.place,
          what_i_learned: form.learned,
          preference_updates: form.prefs,
          how_to_reach_me: form.contact,
        }),
      });
      const j = await res.json();
      setStatus(j.success ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Tell us about a place">
      <div className="sheet-scroll">
        <div className="sheet-topbar">
          <button className="sheet-x" onClick={onClose} aria-label="Close">✕</button>
          <button className="sheet-done" onClick={onClose}>Close</button>
        </div>
        <h1 className="sheet-title">Tell us about a place</h1>
        <p className="sheet-help">Log what you learned about a building or note a new preference. It goes to Seth, who updates the finder.</p>

        {status === "done" ? (
          <p className="feedback-done">Thank you. Your note was sent. Seth will fold it into the finder.</p>
        ) : (
          <form onSubmit={submit} className="feedback-form">
            <label className="stacked-field">
              <span>Which place?</span>
              <input type="text" value={form.place} onChange={set("place")} placeholder="Building name" />
            </label>
            <label className="stacked-field">
              <span>What did you learn?</span>
              <textarea rows="4" value={form.learned} onChange={set("learned")} placeholder="What you saw, liked, disliked, asked the leasing office" />
            </label>
            <label className="stacked-field">
              <span>Anything new about what you want?</span>
              <textarea rows="3" value={form.prefs} onChange={set("prefs")} placeholder="A preference that changed, a new must-have, a deal-breaker" />
            </label>
            <label className="stacked-field">
              <span>How to reach you (optional)</span>
              <input type="text" value={form.contact} onChange={set("contact")} placeholder="Phone or email" />
            </label>
            <input type="checkbox" name="botcheck" className="sr-only" tabIndex="-1" autoComplete="off" />
            {status === "error" && <p className="feedback-error">Something went wrong sending that. Try again, or text Seth directly.</p>}
            <button className="show-btn" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending..." : "Send to Seth"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- root ---------- */

export default function App({ config, buildings }) {
  const factors = config.factors || [];
  const locations = config.locations || [];
  const scales = config.scoreScales || {};

  const [mode, setMode] = useState((config.filterDefaults && config.filterDefaults.distanceMode) || "walk");
  const [refineOpen, setRefineOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [feedback, setFeedback] = useState(null); // null = closed; string = open, prefilled place

  const [factorState, setFactorState] = useState(() => {
    const init = {};
    for (const f of factors) {
      const d = f.default || {};
      const must = !!d.must;
      init[f.key] = { on: !!d.on, must, weight: typeof d.weight === "number" ? d.weight : must ? 100 : 50 };
    }
    return init;
  });

  const [typeState, setTypeState] = useState(() => {
    const opts = (config.buildingTypes && config.buildingTypes.options) || [];
    return new Set(opts.filter((o) => o.default).map((o) => o.key));
  });

  const mustFeatures = useMemo(() => activeMustFeatures(factors, factorState), [factors, factorState]);
  const mustUnit = useMemo(() => mustFeatures.filter((f) => f.level === "unit"), [mustFeatures]);

  const ranked = useMemo(() => {
    return (buildings || [])
      .filter((b) => buildingPasses(b, factors, factorState, typeState))
      .map((b) => {
        const bestUnit = bestQualifyingUnit(b, mustUnit);
        const qualifyingUnits = (b.units || []).filter((u) => unitPassesMusts(u, mustUnit));
        return { building: b, bestUnit, qualifyingUnits, score: scoreBuilding(b, bestUnit, factors, factorState, scales) };
      })
      .sort((a, b) => b.score - a.score);
  }, [buildings, factors, factorState, typeState, mustUnit, scales]);

  const count = ranked.length;
  const title = (config.appText && config.appText.title) || "Apartments";

  return (
    <>
      <main className="app">
        <header className="page-head">
          <h1 className="page-title">{title}</h1>
          <p className="match-count" aria-live="polite">{count} building{count === 1 ? "" : "s"} match</p>
        </header>

        {count === 0 ? (
          <div className="empty">No buildings match right now. Loosen a Must have in Refine, or wait for more buildings to be added.</div>
        ) : (
          <div className="card-list">
            {ranked.map((entry, i) => (
              <BuildingCard
                key={entry.building.id}
                entry={entry}
                rank={i + 1}
                mustFeatures={mustFeatures}
                locations={locations}
                mode={mode}
                expanded={expandedId === entry.building.id}
                onToggle={() => setExpandedId((cur) => (cur === entry.building.id ? null : entry.building.id))}
                onFeedback={() => setFeedback(entry.building.name)}
              />
            ))}
          </div>
        )}
        <button className="feedback-open" onClick={() => setFeedback("")}>
          Learned something about a place? Tell us →
        </button>
      </main>

      <nav className="bottom-bar" aria-label="View controls">
        <div className="bottom-bar-inner">
          <div className="segmented" role="radiogroup" aria-label="Show distances by">
            <label>
              <input type="radio" name="mode" value="walk" checked={mode === "walk"} onChange={() => setMode("walk")} />
              <span>Walk</span>
            </label>
            <label>
              <input type="radio" name="mode" value="drive" checked={mode === "drive"} onChange={() => setMode("drive")} />
              <span>Drive</span>
            </label>
          </div>
          <button className="refine-btn" onClick={() => setRefineOpen(true)}>Refine ({count})</button>
        </div>
      </nav>

      {refineOpen && (
        <RefineSheet
          config={config}
          factorState={factorState}
          setFactorState={setFactorState}
          typeState={typeState}
          setTypeState={setTypeState}
          count={count}
          onClose={() => setRefineOpen(false)}
        />
      )}

      {feedback !== null && <FeedbackSheet place={feedback} onClose={() => setFeedback(null)} />}
    </>
  );
}
