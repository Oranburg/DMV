---
title: Doorman-building research for the DMV apartment search
purpose: >
  A standing, durable record of the candidate-building research, kept separate
  from the site data so the search and verification effort is never lost,
  regardless of which fields the site ends up using. The site data in
  src/data/housing-properties.json is DERIVED from this research; this directory
  is the source of record.
status: in_progress
runs:
  - id: run-2026-06-19-doorman-medium
    date_started: 2026-06-19T11:08-04:00
    date_completed: null
    run_by: Claude Code (Opus 4.8) directing a workflow of cheaper agents
    workflow:
      tool: Claude Code Workflow harness
      workflow_run_id: wf_b99634b5-171
      task_id: wsuinzwdt
      script: >
        .claude/.../workflows/scripts/doorman-building-discovery-wf_b99634b5-171.js
        (session-local; methodology reproduced below)
    method:
      - phase: Discover
        what: One agent per neighborhood searches several sources for any building that plausibly has a staffed/controlled-access lobby.
        model: claude-sonnet (volume work)
        agents: 7 (one per neighborhood)
      - phase: Dedupe
        what: Merge candidates across neighborhoods by normalized building name; drop duplicates.
        model: none (deterministic code in the workflow)
      - phase: Verify
        what: One agent per surviving candidate confirms the must-haves against the building's own site and the web.
        model: claude-sonnet
      - phase: Synthesize
        what: Clean, sort by doorman status, write the candidate JSON, summarize for the human.
        model: claude-opus
    area_scope: Medium (Montgomery County MD Red Line corridor plus adjacent upper-NW DC)
    neighborhoods:
      - Downtown Silver Spring, MD
      - Wheaton and Kemp Mill, MD
      - Downtown Bethesda, MD
      - Friendship Heights, MD and adjacent upper NW DC
      - North Bethesda and White Flint, MD
      - Rockville Pike and Rockville Town Center, MD
      - Takoma Park and Takoma, MD/DC
    sources_queried:
      - apartments.com amenity filters (Concierge, Controlled Access)
      - Google web search ("24 hour concierge apartments <area>", "doorman building <area>")
      - RentCafe
      - PadMapper
      - individual building / management-company websites
    fields_captured_per_building:
      - name, address, neighborhood, nearestMetro, leasingUrl, photoUrl
      - doormanStatus (Confirmed 24h | Likely staffed | Daytime only | No | Unclear)
      - doormanEvidence (the wording/source behind the status)
      - has2BRor1BRDen, balcony, inUnitLaundry, elevator, pool (Yes | No | Unclear)
      - petPolicy, approxRentRange, notes
    limitations:
      - A true 24-hour doorman is rarely stated explicitly online; "Confirmed 24h" requires explicit evidence, otherwise a building is "Likely staffed" and needs a confirming phone call.
      - Coverage is thorough but not provably exhaustive; a building just outside the searched neighborhoods can be missed.
      - Rent ranges and unit specifics are point-in-time and should be re-checked on the leasing page before contact.
    outputs:
      - research/doorman-candidates.json (machine-readable, written by the run)
      - research/README.md (this provenance record)
---

# Doorman-building research

This directory is the durable record of the candidate-building search for the
apartment tool. It exists so the expensive part (finding and verifying real
24-hour-doorman buildings) survives independent of how the site is built. The
site reads from `src/data/`, which is derived from the findings here. If the
site schema changes, the research below is still intact.

## What is here

- **`doorman-candidates.json`** is the verified candidate list, one record per
  building, sorted with confirmed 24-hour-doorman buildings first. Each record
  carries its own evidence and source so a claim can be traced back.
- **The YAML front-matter above** records how the search was run, when, by what
  method and models, over which neighborhoods, against which sources, and what
  the known limitations are. Update `date_completed` and `status`, and add a new
  entry under `runs:` whenever the search is re-run or widened.

## How to re-run or widen

Re-running means launching the same discovery and verification workflow over a
different `area_scope` (for example, the "Wide" inside-the-Beltway scope) and
appending a new dated entry under `runs:` rather than overwriting this one. Each
run is additive to the record; the point is that no past research effort is
discarded.

## The one field that still needs a human

`doorman​Status` of "Likely staffed" means a concierge or front desk exists but
the public record did not state the hours. Confirming 24-hour coverage is a
short phone call per building. That call is the only step the fan-out cannot
finish on its own, and the tool flags those buildings as "needs confirmation"
until the call is made.
