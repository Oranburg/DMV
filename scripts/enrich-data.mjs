#!/usr/bin/env node
/*
 * Offline data enrichment for the apartment finder. Run locally, never in the
 * browser (the WalkScore key must stay private and the API has no CORS).
 *
 *   WALKSCORE_API_KEY=xxxx node scripts/enrich-data.mjs
 *
 * Steps, each idempotent and skipped when the data is already present:
 *   1. Geocode each building's address to coords via OpenStreetMap Nominatim
 *      (no key, 1 request/second per their usage policy).
 *   2. Fetch Walk, Transit, and Bike scores from the WalkScore API and store
 *      them on building.scores, with the ws_link as the "what's nearby" drill-down.
 *
 * Get a free WalkScore key at https://www.walkscore.com/professional/api.php
 * Distances (drive/walk minutes to the three landmarks) are a separate routing
 * step; this script only fills coords and the WalkScore numbers.
 */

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";

// Load a local, gitignored .env (KEY=VALUE per line) if present, so the secret
// WalkScore key never has to be typed inline or committed.
const ENV_FILE = new URL("../.env", import.meta.url);
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DATA = new URL("../src/data/housing-properties.json", import.meta.url);
const KEY = process.env.WALKSCORE_API_KEY || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "User-Agent": "dmv-apartment-finder/1.0 (personal use)" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  if (!json.length) return null;
  return [Number(json[0].lat), Number(json[0].lon)];
}

async function walkscore(address, lat, lon) {
  if (!KEY) return null;
  const url = `https://api.walkscore.com/score?format=json&transit=1&bike=1&address=${encodeURIComponent(address)}&lat=${lat}&lon=${lon}&wsapikey=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WalkScore ${res.status}`);
  const j = await res.json();
  if (j.status !== 1) return { pending: true, status: j.status };
  return {
    walk: typeof j.walkscore === "number" ? j.walkscore : null,
    transit: j.transit && typeof j.transit.score === "number" ? j.transit.score : null,
    bike: j.bike && typeof j.bike.score === "number" ? j.bike.score : null,
    wsLink: j.ws_link || null,
    fetchedOn: new Date().toISOString().slice(0, 10), // cached: WalkScore is stable on this project's timeline
  };
}

function geocodable(address) {
  return address && !/confirm|needs verification/i.test(address);
}

// Public landmarks (anchors) and relevant Red Line / Metro stations, [lat, lon].
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

function nearestStation(coords) {
  return METRO_STATIONS.slice().sort((a, b) => haversineMi(coords, a.c) - haversineMi(coords, b.c))[0];
}

// Real driving minutes via the public OSRM demo server (no key). Returns null on failure.
async function driveMinutes(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const sec = j.routes && j.routes[0] && j.routes[0].duration;
  return typeof sec === "number" ? Math.round(sec / 60) : null;
}

async function routeDistances(b) {
  const station = nearestStation(b.coords);
  const metroDrive = await driveMinutes(b.coords, station.c);
  await sleep(250);
  const synDrive = await driveMinutes(b.coords, ANCHORS.synagogue);
  await sleep(250);
  const berDrive = await driveMinutes(b.coords, ANCHORS.berman);
  await sleep(250);
  // Walk-to-Metro: use sourced minutes if present, else estimate from straight-line
  // distance to the nearest station at a walking pace (~22 min/mile).
  const metroWalk =
    typeof b.walkToMetroMin === "number" ? b.walkToMetroMin : Math.max(1, Math.round(haversineMi(b.coords, station.c) * 22));
  return {
    metro: { drive: metroDrive, walk: metroWalk, station: station.name },
    synagogue: { drive: synDrive },
    berman: { drive: berDrive },
  };
}

async function main() {
  const arr = JSON.parse(await readFile(DATA, "utf8"));
  if (!KEY) console.warn("No WALKSCORE_API_KEY set: will geocode only, scores stay pending.");

  for (const b of arr) {
    if (!geocodable(b.address)) {
      console.log(`skip (address not final): ${b.name}`);
      continue;
    }
    try {
      if (!b.coords) {
        b.coords = await geocode(b.address);
        console.log(`geocoded ${b.name} -> ${b.coords ? b.coords.join(", ") : "no match"}`);
        await sleep(1100); // Nominatim policy: <= 1 req/sec
      }
      if (b.coords && KEY && (!b.scores || b.scores.walk == null)) {
        const s = await walkscore(b.address, b.coords[0], b.coords[1]);
        if (s && !s.pending) {
          b.scores = s;
          console.log(`walkscore ${b.name} -> walk ${s.walk}, transit ${s.transit}, bike ${s.bike}`);
        } else {
          console.log(`walkscore pending for ${b.name} (status ${s && s.status})`);
        }
        await sleep(300);
      }
      if (b.coords && (!b.distances || b.distances.synagogue?.drive == null || b.distances.berman?.drive == null || !b.distances.metro?.station)) {
        b.distances = await routeDistances(b);
        console.log(`routed ${b.name} -> metro ${b.distances.metro.drive}m drive (${b.distances.metro.station}), KMS ${b.distances.synagogue.drive}m, Berman ${b.distances.berman.drive}m`);
      }
      if (b.coords && b.distances && b.distances.metro && b.distances.metro.walk == null) {
        const st = nearestStation(b.coords);
        b.distances.metro.walk = Math.max(1, Math.round(haversineMi(b.coords, st.c) * 22));
        console.log(`metro walk estimate ${b.name} -> ${b.distances.metro.walk} min`);
      }
    } catch (err) {
      console.warn(`error on ${b.name}: ${err.message}`);
    }
  }

  await writeFile(DATA, JSON.stringify(arr, null, 2) + "\n");
  console.log("wrote", arr.length, "buildings");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
