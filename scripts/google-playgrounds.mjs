#!/usr/bin/env node
/*
 * One-time, cached "playground nearby" flag via the Google Places Nearby Search.
 *
 *   GOOGLE_MAPS_API_KEY=xxxx node scripts/google-playgrounds.mjs
 *
 * Whether a playground sits within an easy walk of a building is static, so we
 * query each building once, set building.playground (true/false), record the
 * nearest hit in building.playgroundMeta, and stamp source:"google" as the cache
 * gate. A second run finds every building stamped and makes zero API calls.
 *
 * "Nearby" means a playground or park within WALK_M metres (~half a mile, a
 * comfortable walk for a visiting grandparent). Places ranks by relevance, so we
 * re-check each result's straight-line distance and only count the close ones.
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
const WALK_M = 800; // ~0.5 mile

function metresBetween(a, b) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

async function nearbyPlaygrounds(coords) {
  const [lat, lng] = coords;
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}` +
    `&radius=${WALK_M}&keyword=playground&key=${KEY}`;
  const res = await fetch(url);
  const j = await res.json();
  if (j.status !== "OK" && j.status !== "ZERO_RESULTS") {
    throw new Error(`Places ${j.status}: ${j.error_message || ""}`);
  }
  return (j.results || [])
    .map((r) => ({
      name: r.name,
      vicinity: r.vicinity || "",
      dist: metresBetween(coords, [r.geometry.location.lat, r.geometry.location.lng]),
    }))
    .filter((r) => r.dist <= WALK_M)
    .sort((a, b) => a.dist - b.dist);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!KEY) {
    console.error("No GOOGLE_MAPS_API_KEY set (.env). Nothing to do.");
    process.exit(1);
  }
  const arr = JSON.parse(await readFile(DATA, "utf8"));
  const todo = arr.filter((b) => Array.isArray(b.coords) && b.playgroundMeta?.source !== "google");
  if (!todo.length) {
    console.log(`all ${arr.length} buildings already have a google playground flag; 0 API calls.`);
    return;
  }

  let calls = 0;
  for (const b of todo) {
    const hits = await nearbyPlaygrounds(b.coords);
    b.building = b.building || {};
    b.building.playground = hits.length > 0;
    b.playgroundMeta = {
      source: "google",
      nearest: hits[0] ? { name: hits[0].name, metres: Math.round(hits[0].dist) } : null,
    };
    calls += 1;
    const near = hits[0] ? `${hits[0].name} (${Math.round(hits[0].dist)}m)` : "none within " + WALK_M + "m";
    console.log(`${b.building.playground ? "YES" : "no "} ${b.name} -> ${near}`);
    await sleep(150);
  }

  await writeFile(DATA, JSON.stringify(arr, null, 2) + "\n");
  console.log(`flagged ${todo.length} buildings in ${calls} Places calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
