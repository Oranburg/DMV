export const meta = {
  name: "silver-spring-concierge",
  description: "Discover and verify every Silver Spring building with 24/7 lobby staff (concierge/doorman), writing each to disk as it finishes",
  phases: [
    { title: "Discover", detail: "find Silver Spring concierge buildings from several angles" },
    { title: "Verify", detail: "verify each against Penny's criteria; crash-safe per-building writes" },
  ],
};

const SEED = [
  "Eleven55 Ripley",
  "The Veridian",
  "Thayer & Spring",
  "The Pearl (Silver Spring)",
  "Lenox Park",
  "Arrive Silver Spring",
];

const ANGLES = [
  "the downtown Silver Spring core (Ellsworth Drive, Fenton Street, Georgia Avenue, Wayne Avenue) near the Silver Spring Metro",
  "the Ripley District and South Silver Spring (near the Metro and the Paul S. Sarbanes Transit Center), including newer high-rises",
  "Fenton Village, the Blair area, and the East-West Highway corridor in Silver Spring",
];

const CAND_SCHEMA = {
  type: "object",
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" }, evidence: { type: "string" }, leasingUrl: { type: "string" } },
      },
    },
  },
};

const RECORD_SCHEMA = {
  type: "object",
  required: ["name", "doormanStatus", "wrote"],
  properties: {
    name: { type: "string" },
    neighborhood: { type: "string" },
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
    phone: { type: "string" },
    photoUrl: { type: "string" },
    approxRentRange: { type: "string" },
    wrote: { type: "boolean" },
  },
};

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

phase("Discover");
const found = await parallel(
  ANGLES.map((angle, i) => () =>
    agent(
      `Search the web to find EVERY apartment or condo building in ${angle} that plausibly has 24-hour lobby staff (a concierge, front desk, or doorman; "concierge" is the common term, all the same idea). Use apartments.com, Google, RentCafe, and building websites. Include likely candidates even if the hours are unstated. Exclude garden-style walk-ups with no front desk. Return name, the evidence of staffing, and the leasing URL.`,
      { label: `discover:SS-${i + 1}`, phase: "Discover", model: "sonnet", schema: CAND_SCHEMA }
    )
  )
);

const seen = new Set();
const names = [];
for (const s of SEED) {
  const k = slugify(s);
  if (!seen.has(k)) { seen.add(k); names.push(s); }
}
for (const r of found.filter(Boolean)) {
  for (const c of r.candidates || []) {
    const k = slugify(c.name);
    if (k && !seen.has(k)) { seen.add(k); names.push(c.name); }
  }
}
log(`Silver Spring candidates to verify: ${names.length}`);

phase("Verify");
const results = await parallel(
  names.map((name) => () => {
    const slug = slugify(name);
    return agent(
      `Verify the Silver Spring, MD building "${name}" against a renter's criteria. Fetch its website and search the web. Determine honestly (use "Unclear" rather than guessing): doormanStatus ("Confirmed 24h" only with explicit evidence of 24-hour staffing; "Likely staffed" if a concierge/front desk exists but hours are unstated); buildingType (apartment vs condo); has2BRor1BRDen; balcony; inUnitLaundry; elevator; petFriendly; pool; gym; packageRoom; unitClimate (heat/AC controlled in the unit = Yes, by the building = No); wellMaintained; bathroomsNote; address; leasingUrl; the leasing office phone number; a photoUrl (prefer og:image); and an observed 2BR rent range. Set neighborhood to "Silver Spring". Then WRITE the full record as pretty-printed JSON to research/buildings/${slug}.json (writing the file is required; it is how the work is saved). Return the structured summary with wrote=true.`,
      { label: `verify:${name.slice(0, 24)}`, phase: "Verify", model: "sonnet", schema: RECORD_SCHEMA }
    );
  })
);

const done = results.filter(Boolean);
const confirmed = done.filter((r) => r.doormanStatus === "Confirmed 24h").length;
log(`Verified ${done.length} Silver Spring buildings; ${confirmed} with confirmed 24h staffing. Saved to research/buildings/.`);
return { verified: done.length, confirmed, buildings: done.map((r) => ({ name: r.name, doormanStatus: r.doormanStatus })) };
