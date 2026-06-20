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

// Build years confirmed by web lookup for buildings whose research notes carry no
// construction year. Used only as a fallback when extraction finds nothing.
// Each year is the ORIGINAL construction, not a renovation.
const MANUAL_YEARS = {
  bellatthepike: 2015, // apartmentfinder/zillow listings, "Built 2015"
  blairhouse: 1959, // rentable.co, 8201 16th St (Tower Companies); medium confidence, pre-SDAT
  blvdfortyfour: 2015, // opened as "The Upton" (Bozzuto), renamed after Comstock's 2021 buy
  galvanattwinbrook: 2015, // DAVIS Construction project page
  pallasatpikerose: 2015, // UrbanTurf, first move-ins Spring 2015
  perseiatpikerose: 2014, // Bethesda Magazine, first Pike & Rose residential building, May 2014
  solaire8250georgia: 2019, // Washington Property Company site, "completed spring of 2019"
  thehenriatpikerose: 2017, // resident reviews + 2017 pre-leasing (ignore the 2022 copyright artifact)
  twintowers: 1967, // RentCafe building details, "constructed in 1967" (Southern Management)
  victorytower: 1971, // AGM Financial, "Built in 1971 and renovated 2004/2005" (original year)
};

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
    const year = years.length ? years[0] : MANUAL_YEARS[nm] ?? null; // notes first, then verified lookup
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
