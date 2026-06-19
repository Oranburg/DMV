export const meta = {
  name: "verify-candidates",
  description: "Verify a known list of candidate doorman buildings against the renter's criteria, writing each result to disk immediately so a session limit can never lose completed work",
  phases: [{ title: "Verify", detail: "one agent per building; each writes its own file as it finishes" }],
};

/*
 * Crash-safe by design. Each agent writes research/buildings/<slug>.json the
 * moment it finishes, so an interruption (session limit, etc.) keeps every
 * building completed so far. The earlier run lost everything because it only
 * wrote at the very end; this one never does that.
 *
 * Invoke with the candidate list, for example the salvaged names:
 *   Workflow({ scriptPath: "scripts/verify-candidates.workflow.js",
 *              args: { candidates: [{name, neighborhood}, ...] } })
 */

const SALVAGED = [
  { name: "Pallas at Pike & Rose", neighborhood: "North Bethesda" },
  { name: "Fenestra at The Square", neighborhood: "North Bethesda (Pike & Rose)" },
  { name: "The Henri at Pike & Rose", neighborhood: "North Bethesda" },
  { name: "Bell at the Pike", neighborhood: "North Bethesda" },
  { name: "Kite House at Pike & Rose", neighborhood: "North Bethesda" },
  { name: "The Hartley at Pike & Rose", neighborhood: "North Bethesda" },
  { name: "PerSei at Pike & Rose", neighborhood: "North Bethesda" },
  { name: "BLVD Ansel", neighborhood: "Rockville" },
  { name: "BLVD Forty Four", neighborhood: "Rockville" },
  { name: "The Met Rockville", neighborhood: "Rockville Town Center" },
  { name: "Aurora Apartments", neighborhood: "Rockville" },
  { name: "Galvan at Twinbrook", neighborhood: "Rockville (Twinbrook)" },
  { name: "The Alaire at Twinbrook", neighborhood: "Rockville (Twinbrook)" },
  { name: "Victory Tower", neighborhood: "Rockville" },
  { name: "Grosvenor Park I", neighborhood: "North Bethesda (Grosvenor)" },
  { name: "Grosvenor Park II", neighborhood: "North Bethesda (Grosvenor)" },
  { name: "Grosvenor Park III", neighborhood: "North Bethesda (Grosvenor)" },
  { name: "Park Ritchie", neighborhood: "Silver Spring" },
  { name: "Takoma Overlook", neighborhood: "Takoma" },
  { name: "Gables Takoma Park", neighborhood: "Takoma Park" },
  { name: "Takoma Central", neighborhood: "Takoma" },
  { name: "Willow & Maple", neighborhood: "Takoma Park" },
  { name: "The Vale at the Park", neighborhood: "Silver Spring / Takoma" },
];

const candidates = (args && args.candidates && args.candidates.length) ? args.candidates : SALVAGED;
if (!candidates.length) {
  log("No candidates available.");
  return { error: "no candidates" };
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const RECORD_SCHEMA = {
  type: "object",
  required: ["name", "doormanStatus", "wrote"],
  properties: {
    name: { type: "string" },
    doormanStatus: { type: "string", enum: ["Confirmed 24h", "Likely staffed", "Daytime only", "No", "Unclear"] },
    buildingType: { type: "string", enum: ["apartment", "condo", "unclear"] },
    has2BRor1BRDen: { type: "string", enum: ["Yes", "No", "Unclear"] },
    balcony: { type: "string", enum: ["Yes", "No", "Unclear"] },
    inUnitLaundry: { type: "string", enum: ["Yes", "No", "Unclear"] },
    elevator: { type: "string", enum: ["Yes", "No", "Unclear"] },
    bathroomsNote: { type: "string" },
    petFriendly: { type: "string", enum: ["Yes", "No", "Unclear"] },
    pool: { type: "string", enum: ["Yes", "No", "Unclear"] },
    gym: { type: "string", enum: ["Yes", "No", "Unclear"] },
    packageRoom: { type: "string", enum: ["Yes", "No", "Unclear"] },
    unitClimate: { type: "string", enum: ["Yes", "No", "Unclear"] },
    wellMaintained: { type: "string", enum: ["Yes", "No", "Unclear"] },
    address: { type: "string" },
    leasingUrl: { type: "string" },
    phone: { type: "string", description: "leasing office phone number, digits with area code" },
    photoUrl: { type: "string" },
    approxRentRange: { type: "string" },
    wrote: { type: "boolean" },
  },
};

phase("Verify");
const results = await parallel(
  candidates.map((c) => () => {
    const slug = slugify(c.name);
    return agent(
      `Verify the apartment/condo building "${c.name}" in ${c.neighborhood || "the Maryland DC suburbs"} against a renter's criteria. Fetch the building's own website and search the web.\n\nDetermine, honestly (use "Unclear" rather than guessing):\n- doormanStatus: "Confirmed 24h" only with explicit evidence the lobby is staffed 24 hours; "Likely staffed" if a concierge/front desk exists but hours are unstated.\n- buildingType: apartment (one rental building, central management) or condo (individually owned units rented by owners).\n- has2BRor1BRDen, balcony, inUnitLaundry, elevator, petFriendly, pool, gym, packageRoom.\n- unitClimate: are heat and AC controlled inside the unit (Yes) or by the building (No)?\n- wellMaintained: does it read as well-kept and not run-down with deferred repairs?\n- bathroomsNote: typical bathroom counts in 2BR units (e.g., "2BR has 2 baths", "1.5 baths common").\n- address, leasingUrl, the leasing office phone number, a photoUrl (prefer og:image), and an observed 2BR rent range.\n\nThen WRITE your findings as pretty-printed JSON to the file research/buildings/${slug}.json (include every field above plus the building name and neighborhood). Writing the file is required; it is how the work is saved. Finally return the structured summary with wrote=true.`,
      { label: `verify:${c.name.slice(0, 22)}`, phase: "Verify", model: "sonnet", schema: RECORD_SCHEMA }
    );
  })
);

const done = results.filter(Boolean);
const confirmed = done.filter((r) => r.doormanStatus === "Confirmed 24h").length;
const likely = done.filter((r) => r.doormanStatus === "Likely staffed").length;
log(`Verified ${done.length}/${candidates.length}. Confirmed 24h: ${confirmed}, likely staffed: ${likely}. Each saved to research/buildings/.`);

return { verified: done.length, confirmed, likely, buildings: done.map((r) => ({ name: r.name, doormanStatus: r.doormanStatus, type: r.buildingType })) };
