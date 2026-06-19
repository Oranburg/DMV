export const meta = {
  name: "wheaton-concierge",
  description: "Discover and verify Wheaton-area buildings with 24/7 lobby staff (concierge/doorman), writing each to disk as it finishes",
  phases: [
    { title: "Discover", detail: "find Wheaton concierge buildings from several angles" },
    { title: "Verify", detail: "verify each against Penny's criteria; crash-safe per-building writes" },
  ],
};

const ANGLES = [
  "downtown Wheaton near the Wheaton Metro station (Georgia Avenue, University Boulevard, Reedie Drive, Veirs Mill Road, Grandview Avenue), including newer transit-oriented high-rises",
  "the Wheaton triangle and the Wheaton/Kensington and Wheaton/Forest Glen borders, mid-rise and high-rise rental buildings with a front desk",
  "apartment and condo high-rises within about a mile of the Wheaton Metro that advertise a concierge, front desk, or controlled-access lobby",
];

const CAND_SCHEMA = {
  type: "object",
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: { type: "object", required: ["name"], properties: { name: { type: "string" }, evidence: { type: "string" }, leasingUrl: { type: "string" } } },
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

const slugify = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

phase("Discover");
const found = await parallel(
  ANGLES.map((angle, i) => () =>
    agent(
      `Search the web to find apartment or condo buildings in ${angle} that plausibly have 24-hour lobby staff (concierge, front desk, or doorman; all the same idea). Use apartments.com, Google, RentCafe, and building websites. Wheaton has fewer such buildings than downtown Silver Spring, so be thorough and include likely candidates even if hours are unstated, but exclude garden-style walk-ups with no front desk. Return name, the evidence of staffing, and the leasing URL.`,
      { label: `discover:Wheaton-${i + 1}`, phase: "Discover", model: "sonnet", schema: CAND_SCHEMA }
    )
  )
);

const seen = new Set();
const names = [];
for (const r of found.filter(Boolean)) {
  for (const c of r.candidates || []) {
    const k = slugify(c.name);
    if (k && !seen.has(k)) { seen.add(k); names.push(c.name); }
  }
}
log(`Wheaton candidates to verify: ${names.length}`);

phase("Verify");
const results = await parallel(
  names.map((name) => () => {
    const slug = slugify(name);
    return agent(
      `Verify the Wheaton, Maryland building "${name}" against a renter's criteria. Fetch its website and search the web. Determine honestly (use "Unclear" rather than guessing): doormanStatus ("Confirmed 24h" only with explicit evidence of 24-hour staffing; "Likely staffed" if a concierge/front desk exists but hours are unstated); buildingType (apartment vs condo); has2BRor1BRDen; balcony; inUnitLaundry; elevator; petFriendly; pool; gym; packageRoom; unitClimate (heat/AC controlled in the unit = Yes, by the building = No); wellMaintained; bathroomsNote; address; leasingUrl; the leasing office phone number; a photoUrl (prefer og:image); and an observed 2BR rent range. Set neighborhood to "Wheaton". Then WRITE the full record as pretty-printed JSON to research/buildings/${slug}.json (writing the file is required; it is how the work is saved). Return the structured summary with wrote=true.`,
      { label: `verify:${name.slice(0, 24)}`, phase: "Verify", model: "sonnet", schema: RECORD_SCHEMA }
    );
  })
);

const done = results.filter(Boolean);
const confirmed = done.filter((r) => r.doormanStatus === "Confirmed 24h").length;
log(`Verified ${done.length} Wheaton buildings; ${confirmed} confirmed 24h. Saved to research/buildings/.`);
return { verified: done.length, confirmed, buildings: done.map((r) => ({ name: r.name, doormanStatus: r.doormanStatus })) };
