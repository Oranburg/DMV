#!/usr/bin/env node
/*
 * One-time, cached point-to-point distances via the Google Distance Matrix API.
 *
 *   GOOGLE_MAPS_API_KEY=xxxx node scripts/google-distances.mjs
 *
 * Why this exists: drive times to Kemp Mill Synagogue and Berman, and the walk
 * to the nearest Metro, are STATIC (a building does not move). The Google API
 * bills per origin-destination element, so we compute each pair exactly once,
 * stamp the building's distances with source:"google", and never call again.
 * A second run finds every building already stamped and makes zero API calls.
 *
 * Distances written per building:
 *   distances.synagogue.drive  - minutes driving to Kemp Mill Synagogue (typical traffic)
 *   distances.berman.drive     - minutes driving to Berman Hebrew Academy (typical traffic)
 *   distances.metro.walk       - minutes walking to the nearest Metro station
 *   distances.metro.station    - the nearest station's name
 *   distances.source           - "google" (the cache marker; gates re-computation)
 *
 * Google's plain `duration` (no departure_time) reflects typical road speeds,
 * which matched the hand-checked Henri -> KMS figure (22 vs 21 min). We use it
 * rather than live duration_in_traffic so the cached numbers are reproducible.
 */

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

const ENV_FILE = new URL("../.env", import.meta.url);
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DATA = new URL("../src/data/housing-properties.json", import.meta.url);
const KEY = process.env.GOOGLE_MAPS_API_KEY || "";

const ANCHORS = {
  synagogue: [39.0407, -77.0205], // Kemp Mill Synagogue
  berman: [39.0739, -77.1196], // Berman Hebrew Academy
};
const METRO_STATIONS = [
  { name: "Silver Spring", c: [38.9938, -77.0301] },
  { name: "Wheaton", c: [39.0383, -77.0512] },
  { name: "Forest Glen", c: [39.0151, -77.0428] },
  { name: "Glenmont", c: [39.0613, -77.0533] },
  { name: "Takoma", c: [38.9759, -77.0177] },
  { name: "Rockville", c: [39.084, -77.1464] },
  { name: "Twinbrook", c: [39.0623, -77.1209] },
  { name: "North Bethesda", c: [39.0481, -77.113] },
  { name: "Grosvenor-Strathmore", c: [39.0294, -77.1041] },
  { name: "Bethesda", c: [38.9847, -77.0947] },
  { name: "Medical Center", c: [38.9998, -77.0972] },
  { name: "Friendship Heights", c: [38.9601, -77.0853] },
];

function haversineMi(a, b) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
const nearestStation = (c) => METRO_STATIONS.slice().sort((a, b) => haversineMi(c, a.c) - haversineMi(c, b.c))[0];
const ll = (c) => `${c[0]},${c[1]}`;
const minutes = (e) => (e && e.status === "OK" ? Math.round(e.duration.value / 60) : null);

// One Distance Matrix request: many origins, one or more destinations. Google
// caps a request at 25 origins and 100 elements, so callers chunk origins.
async function matrix(origins, destinations, mode) {
  const o = origins.map(ll).join("|");
  const d = destinations.map(ll).join("|");
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(o)}` +
    `&destinations=${encodeURIComponent(d)}&mode=${mode}&units=imperial&key=${KEY}`;
  const res = await fetch(url);
  const j = await res.json();
  if (j.status !== "OK") throw new Error(`Distance Matrix ${j.status}: ${j.error_message || ""}`);
  return j.rows.map((r) => r.elements);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  if (!KEY) {
    console.error("No GOOGLE_MAPS_API_KEY set (.env). Nothing to do.");
    process.exit(1);
  }
  const arr = JSON.parse(await readFile(DATA, "utf8"));

  // Only buildings with coords that are not already Google-sourced. This is the
  // cache gate: once stamped source:"google", a building is never re-queried.
  const todo = arr.filter((b) => Array.isArray(b.coords) && b.distances?.source !== "google");
  const skipped = arr.length - todo.length;
  if (!todo.length) {
    console.log(`all ${arr.length} buildings already google-sourced; 0 API calls.`);
    return;
  }

  let elements = 0;

  // Drives: origins (chunked at 25) x [KMS, Berman]. 2 elements per building.
  const driveDest = [ANCHORS.synagogue, ANCHORS.berman];
  for (const group of chunk(todo, 25)) {
    const rows = await matrix(group.map((b) => b.coords), driveDest, "driving");
    group.forEach((b, i) => {
      const [syn, ber] = rows[i];
      b.distances = b.distances || {};
      b.distances.synagogue = { drive: minutes(syn) };
      b.distances.berman = { drive: minutes(ber) };
      elements += 2;
    });
  }

  // Walks to the nearest Metro: group by station so each building costs 1 element.
  const byStation = new Map();
  for (const b of todo) {
    const st = nearestStation(b.coords);
    if (!byStation.has(st.name)) byStation.set(st.name, { station: st, buildings: [] });
    byStation.get(st.name).buildings.push(b);
  }
  for (const { station, buildings } of byStation.values()) {
    for (const group of chunk(buildings, 25)) {
      const rows = await matrix(group.map((b) => b.coords), [station.c], "walking");
      group.forEach((b, i) => {
        b.distances.metro = { walk: minutes(rows[i][0]), station: station.name };
        elements += 1;
      });
    }
  }

  for (const b of todo) b.distances.source = "google";

  await writeFile(DATA, JSON.stringify(arr, null, 2) + "\n");
  console.log(
    `google-sourced ${todo.length} buildings (${skipped} already cached) in ${elements} billed elements.`
  );
  for (const b of todo) {
    const d = b.distances;
    console.log(
      `  ${b.name}: KMS ${d.synagogue.drive}m drive, Berman ${d.berman.drive}m drive, ${d.metro.walk}m walk to ${d.metro.station}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
