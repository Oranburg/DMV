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
