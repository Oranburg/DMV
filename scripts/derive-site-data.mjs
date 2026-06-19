#!/usr/bin/env node
/*
 * Derive the site's building data from the research layer.
 *   node scripts/derive-site-data.mjs
 *
 * Sources, merged and de-duped by slug:
 *   1. research/buildings/*.json  (verified records, written incrementally by the verify workflow)
 *   2. the 6 Silver Spring buildings from Gemini's CSV (lower confidence, but rich; noise read from notes)
 *
 * Writes src/data/housing-properties.json (the file the site reads). Run
 * scripts/enrich-data.mjs afterward to add coords, Walk Scores, and drive times.
 * Re-running is safe and idempotent; it rebuilds the file from the research layer.
 */

import { readFile, writeFile, readdir } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const RESEARCH = new URL("research/buildings/", ROOT);
const OUT = new URL("src/data/housing-properties.json", ROOT);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const yn = (v) => (v === "Yes" ? true : v === "No" ? false : null);
const num = (s) => {
  const m = String(s || "").replace(/,/g, "").match(/\$?\s*(\d{3,5})/);
  return m ? Number(m[1]) : 0;
};
const sqftOf = (s) => {
  const m = String(s || "").replace(/,/g, "").match(/(\d{3,4})\s*(?:-\s*\d{3,4})?\s*sq\s*ft/i);
  return m ? Number(m[1]) : null;
};
const bathsOf = (s) => {
  const t = String(s || "");
  if (/\b2\s*bath/i.test(t)) return 2;
  if (/1\.5\s*bath/i.test(t)) return 1.5;
  if (/\b1\s*bath/i.test(t)) return 1;
  return null;
};

function fromVerified(r) {
  const id = slug(r.name);
  // Penny needs full-time staffing. Confirmed 24h => true; "No" or "Daytime only" => fail; "Likely" => verify.
  const doorman = r.doormanStatus === "Confirmed 24h" ? true : r.doormanStatus === "No" || r.doormanStatus === "Daytime only" ? false : null;
  const baths = bathsOf(r.bathroomsNote);
  const sqft = sqftOf(r.approxRentRange) || sqftOf(r.bathroomsNote);
  const noteLines = r.notes && typeof r.notes === "object" ? Object.values(r.notes) : Array.isArray(r.notes) ? r.notes : r.notes ? [r.notes] : [];
  return {
    id,
    name: r.name,
    address: r.address || "",
    neighborhood: r.neighborhood || "",
    buildingType: r.buildingType === "condo" ? "condo" : "apartment",
    leasingUrl: r.leasingUrl || null,
    phone: r.phone || null,
    photos: r.photoUrl ? [r.photoUrl] : [],
    coords: null,
    scores: { walk: null, transit: null, bike: null, wsLink: null },
    walkToMetroMin: null,
    distances: null,
    building: {
      doorman,
      doormanStatus: r.doormanStatus || "Unclear",
      elevator: yn(r.elevator),
      pool: yn(r.pool),
      gym: yn(r.gym),
      playground: null,
      petFriendly: yn(r.petFriendly),
      packageRoom: yn(r.packageRoom),
      unitClimate: yn(r.unitClimate),
      wellMaintained: yn(r.wellMaintained),
      noise: null,
    },
    units: [
      {
        id: `${id}-2br`,
        label: "2BR",
        bedrooms: 2,
        den: false,
        bathrooms: baths,
        squareFeet: sqft,
        balcony: yn(r.balcony),
        inUnitLaundry: yn(r.inUnitLaundry),
        view: null,
        pricing: { baseRent: num(r.approxRentRange), parking: 0, utilities: {}, mandatoryFees: 0 },
      },
    ],
    source: "verified",
    notes: noteLines,
  };
}

// Gemini Silver Spring buildings (CSV). noise: 5 very quiet .. 1 loud, read from the notes.
const GEMINI_SS = [
  { name: "Eleven55 Ripley", url: "https://www.udr.com/washington-dc-apartments/silver-spring/eleven55-ripley/", rent: 2472, sqft: 886, metro: 2, kmDrive: 19, noise: 2, note: "Closest to the train tracks; train-facing units are noisy. Ask for high floors on the street side." },
  { name: "The Veridian", url: "https://www.equityapartments.com/maryland/silver-spring/the-veridian-apartments", rent: 2487, sqft: 1086, metro: 5, kmDrive: 18, noise: 2, note: "Train noise significant in the East building; request the West building." },
  { name: "Thayer & Spring", url: "https://rent.brookfieldproperties.com/property/thayer-and-spring/", rent: 2733, sqft: 850, metro: 6, kmDrive: 19, noise: 4, note: "Quieter Fenton Village pocket; very visible front-desk team." },
  { name: "The Pearl", url: "https://www.liveatthepearl.com/", rent: 3200, sqft: 950, metro: 7, kmDrive: 21, noise: 4, note: "Premium building with hotel-standard concierge; set back from traffic, quietest option." },
  { name: "Lenox Park", url: "https://www.lenoxparkliving.com/", rent: 2293, sqft: 1037, metro: 4, kmDrive: 17, noise: 3, note: "High-rise right next to Metro; strong 2BR space-to-rent ratio; pet-friendly." },
  { name: "Arrive Silver Spring", url: "https://www.arriveon-georgiaave.com", rent: 2866, sqft: 1204, metro: 8, kmDrive: 17, noise: 3, note: "Formerly The Cameron; responsive management; straight drive to Kemp Mill down Georgia Ave." },
];

function fromGemini(g) {
  const id = slug(g.name);
  return {
    id,
    name: g.name,
    address: `${g.name}, Silver Spring, MD`,
    neighborhood: "Silver Spring",
    buildingType: "apartment",
    leasingUrl: g.url,
    phone: null,
    photos: [],
    coords: null,
    scores: { walk: null, transit: null, bike: null, wsLink: null },
    walkToMetroMin: g.metro,
    distances: { metro: { walk: g.metro, drive: null, station: "Silver Spring" }, synagogue: { drive: g.kmDrive }, berman: { drive: null } },
    building: {
      doorman: null,
      doormanStatus: "Likely staffed",
      elevator: true,
      pool: null,
      gym: null,
      playground: null,
      petFriendly: null,
      packageRoom: null,
      unitClimate: null,
      wellMaintained: null,
      noise: g.noise,
    },
    units: [
      {
        id: `${id}-2br`,
        label: "2BR",
        bedrooms: 2,
        den: false,
        bathrooms: null,
        squareFeet: g.sqft,
        balcony: true,
        inUnitLaundry: true,
        view: null,
        pricing: { baseRent: g.rent, parking: 0, utilities: {}, mandatoryFees: 0 },
      },
    ],
    source: "gemini-csv (low confidence, verify)",
    notes: [g.note],
  };
}

async function main() {
  // Preserve already-computed enrichment (coords, scores, distances) across re-derives.
  // Verify agents often appended the street address to the name, so the same
  // building landed under several slugs. Strip a trailing "<number> ... <street suffix>"
  // and merge variants. Keep the best record per canonical name.
  const STREET = /\s+\d{2,5}\s+(?:[a-z0-9]+\s+){0,3}?(?:st|street|ave|avenue|rd|road|ln|lane|hwy|highway|blvd|boulevard|dr|drive|pl|place|ct|court|cir|circle|way|pkwy|parkway)\b.*$/i;
  const cleanName = (name) => String(name).replace(/\(.*?\)/g, " ").replace(STREET, "").replace(/\s+/g, " ").trim();
  const canon = (name) => cleanName(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  const key = (name) => slug(canon(name)) || slug(name);

  const prior = new Map();
  try {
    const existing = JSON.parse(await readFile(OUT, "utf8"));
    for (const b of existing) prior.set(key(b.name), b);
  } catch {
    /* first derive */
  }
  const carry = (rec) => {
    const p = prior.get(key(rec.name));
    if (!p) return rec;
    if (p.coords) rec.coords = p.coords;
    if (p.scores && p.scores.walk != null) rec.scores = p.scores;
    if (p.distances && p.distances.synagogue && p.distances.synagogue.drive != null) rec.distances = p.distances;
    if (p.walkToMetroMin != null && rec.walkToMetroMin == null) rec.walkToMetroMin = p.walkToMetroMin;
    if (p.phone && !rec.phone) rec.phone = p.phone;
    return rec;
  };

  const known = (v) => v !== null && v !== undefined && v !== "";
  const completeness = (r) => {
    const b = r.building, u = r.units[0] || {};
    return [b.doorman, b.elevator, b.pool, b.gym, b.petFriendly, b.packageRoom, b.unitClimate, b.wellMaintained, u.bathrooms, u.squareFeet, u.balcony, u.inUnitLaundry, r.phone, r.address].filter(known).length + (r.photos.length ? 1 : 0);
  };
  const dRank = (r) => (r.building.doorman === true ? 2 : r.building.doorman === false ? 0 : 1);
  const better = (a, b) => {
    const av = a.source.startsWith("verified") ? 1 : 0, bv = b.source.startsWith("verified") ? 1 : 0;
    if (av !== bv) return av > bv ? a : b;
    if (dRank(a) !== dRank(b)) return dRank(a) > dRank(b) ? a : b;
    return completeness(a) >= completeness(b) ? a : b;
  };

  const byKey = new Map();
  const add = (rec) => {
    rec.name = cleanName(rec.name);
    const k = key(rec.name);
    rec.id = k;
    if (rec.units[0]) rec.units[0].id = `${k}-2br`;
    const cur = byKey.get(k);
    byKey.set(k, carry(cur ? better(cur, rec) : rec));
  };

  for (const g of GEMINI_SS) add(fromGemini(g));
  let files = [];
  try {
    files = (await readdir(RESEARCH)).filter((f) => f.endsWith(".json"));
  } catch {
    /* none yet */
  }
  for (const f of files) {
    try {
      const r = JSON.parse(await readFile(new URL(f, RESEARCH), "utf8"));
      if (r && r.name) add(fromVerified(r));
    } catch (e) {
      console.warn(`skip ${f}: ${e.message}`);
    }
  }

  // Penny's call (2026-06-19): the far Pike & Rose / Rockville / North Bethesda / Takoma-DC group
  // is too far (e.g., The Henri ~50 min). Keep Silver Spring, where her great choices are.
  const KEEP = /silver spring/i;
  const all = [...byKey.values()];
  const out = all.filter((b) => KEEP.test(b.neighborhood || "")).sort((a, b) => a.name.localeCompare(b.name));
  const dropped = all.length - out.length;
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`derived ${out.length} Silver Spring buildings (dropped ${dropped} out-of-area) from ${files.length} verified files + ${GEMINI_SS.length} Gemini`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
