#!/usr/bin/env node
/*
 * Extract each building's ORIGINAL construction year from its research notes and
 * write it to building.yearBuilt in the site data.
 *
 *   node scripts/derive-year-built.mjs
 *
 * Renovations are deliberately ignored: a refreshed lobby or new carpet does not
 * make a 1966 tower new, so only build/open/completion years count. Buildings with
 * no construction year in the research corpus are left null (the newness factor
 * scores them neutrally rather than guessing).
 */

import { readFile, writeFile, readdir } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const RESEARCH = new URL("research/buildings/", ROOT);
const DATA = new URL("src/data/housing-properties.json", ROOT);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Years tied to original construction. Renovation verbs are excluded on purpose.
function buildYears(blob) {
  const re = /(?:built|opened|completed|delivered|constructed|construction|new construction|builtyear)\D{0,18}(19\d\d|20[0-2]\d)/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(blob))) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

async function main() {
  const files = (await readdir(RESEARCH)).filter((f) => f.endsWith(".json"));
  const byName = new Map();
  for (const f of files) {
    let j;
    try {
      j = JSON.parse(await readFile(new URL(f, RESEARCH), "utf8"));
    } catch {
      continue;
    }
    const nm = norm(j.name || f);
    byName.set(nm, (byName.get(nm) || "") + " " + JSON.stringify(j));
  }

  const arr = JSON.parse(await readFile(DATA, "utf8"));
  let filled = 0;
  const missing = [];
  for (const b of arr) {
    const nm = norm(b.name);
    let blob = byName.get(nm);
    if (!blob) {
      for (const [k, v] of byName) {
        if (k.includes(nm) || nm.includes(k)) {
          blob = v;
          break;
        }
      }
    }
    const years = blob ? buildYears(blob) : [];
    const year = years.length ? years[0] : null; // earliest = original construction
    b.building = b.building || {};
    b.building.yearBuilt = year;
    if (year) filled++;
    else missing.push(b.name);
  }

  await writeFile(DATA, JSON.stringify(arr, null, 2) + "\n");
  console.log(`yearBuilt set for ${filled}/${arr.length} buildings.`);
  console.log(`unknown (left null): ${missing.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
