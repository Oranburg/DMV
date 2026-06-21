// Ingest Penny's feedback notes (the "Apartment note: ..." emails the finder
// sends to Seth) and merge each one into src/data/housing-properties.json as a
// `pennyNote` on the matching building. Idempotent: re-running re-reads the same
// notes and overwrites the pennyNote, preserving every other field.
//
//   node scripts/ingest-penny-notes.mjs ["/path/to/folder of .eml files"]
//
// Default folder: ~/Downloads/Penny  (the trailing space is intentional; that is
// how the mail app exported them). Area-level rules ("no North Bethesda", "no
// Rockville") are NOT baked in here; they live in housing-config.json under
// `penny.excludeNeighborhoods` and are applied live in the app, so a brand-new
// building in a ruled-out area is hidden without re-ingesting.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data", "housing-properties.json");
const FOLDER = process.argv[2] || join(os.homedir(), "Downloads", "Penny ");

/* ---------- minimal .eml plumbing ---------- */

function decodeQP(s) {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// Pull the text/plain part out of a (possibly multipart) message and decode it.
function plainBody(raw) {
  const norm = raw.replace(/\r\n/g, "\n");
  const idx = norm.indexOf("text/plain");
  if (idx === -1) return decodeQP(norm);
  const afterHeaders = norm.indexOf("\n\n", idx);
  if (afterHeaders === -1) return decodeQP(norm);
  let body = norm.slice(afterHeaders + 2);
  const boundary = body.search(/\n--/);
  if (boundary !== -1) body = body.slice(0, boundary);
  return decodeQP(body);
}

function emlDate(raw) {
  const m = raw.match(/^Date:\s*(.+)$/m);
  if (!m) return null;
  const d = new Date(m[1].trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const LABELS = ["place", "what_i_learned", "preference_updates", "how_to_reach_me"];

function parseFields(body) {
  const out = {};
  const re = new RegExp(
    `(${LABELS.join("|")})\\s*:\\s*([\\s\\S]*?)(?=(?:\\n(?:${LABELS.join("|")})\\s*:)|$)`,
    "g"
  );
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2].trim();
  return out;
}

/* ---------- matching + classifying ---------- */

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function matchBuilding(place, buildings) {
  const n = norm(place);
  if (n.length < 3) return null;
  // exact, then containment either direction (longest building name wins)
  let best = null;
  for (const b of buildings) {
    const nb = norm(b.name);
    if (nb === n) return b;
    if (nb.includes(n) || n.includes(nb)) {
      if (!best || norm(best.name).length < nb.length) best = b;
    }
  }
  return best;
}

function inferVerdict(learned, prefs) {
  const t = `${learned} ${prefs}`.toLowerCase();
  if (/back ?up/.test(t)) return "backup";
  if (/don'?t want|do not want|avoid (?:north|rockville|the area)|not .*location/.test(t)) return "rejected";
  if (/complaint|noise|hear the train|avoid any unit|caution/.test(t)) return "caution";
  if (/must be|where is|available|interested|corner/.test(t)) return "interested";
  return "note";
}

/* ---------- run ---------- */

const buildings = JSON.parse(readFileSync(DATA, "utf8"));

let files;
try {
  files = readdirSync(FOLDER).filter((f) => f.toLowerCase().endsWith(".eml"));
} catch {
  console.error(`Could not read folder: ${FOLDER}`);
  process.exit(1);
}

const matched = [];
const unmatched = [];

for (const file of files) {
  const raw = readFileSync(join(FOLDER, file), "utf8");
  const fields = parseFields(plainBody(raw));
  const place = fields.place || "";
  const learned = fields.what_i_learned || "";
  const prefs = fields.preference_updates || "";
  if (!place && !learned) continue;

  const b = matchBuilding(place, buildings);
  if (!b) {
    unmatched.push({ place, learned, prefs });
    continue;
  }
  const note = {
    verdict: inferVerdict(learned, prefs),
    learned: learned || null,
    preferenceUpdate: prefs || null,
    updatedOn: emlDate(raw),
    source: "penny-note",
  };
  for (const k of Object.keys(note)) if (note[k] == null) delete note[k];
  b.pennyNote = note;
  matched.push({ id: b.id, place, verdict: note.verdict });
}

writeFileSync(DATA, JSON.stringify(buildings, null, 2) + "\n");

console.log(`\nMerged ${matched.length} note(s) into ${matched.length} building(s):`);
for (const m of matched) console.log(`  ${m.verdict.padEnd(10)} ${m.place}  ->  ${m.id}`);
if (unmatched.length) {
  console.log(`\nNo building matched (review by hand):`);
  for (const u of unmatched) console.log(`  "${u.place}": ${u.learned.slice(0, 80)}`);
}
console.log();
