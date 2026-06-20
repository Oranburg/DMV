# Apartment Finder (DMV)

A mobile-first apartment-search tool for one renter, focused on 24-hour-doorman buildings in the DC / Maryland suburbs. Built with Astro and a single React island, deployed to GitHub Pages at https://oranburg.law/DMV/.

## How it works

She picks a building first, then a unit inside it. The four must-haves are non-negotiable and filter the list; everything else is a weighted preference she turns on and slides to set its importance, which produces the ranking.

- Must-have (locked): 2BR or 1BR+den, 24-hour doorman/concierge, balcony, in-unit laundry.
- Preferences (weighted): cost, walk to Metro, quiet, elevator, pet-friendly, close to Kemp Mill Synagogue, close to Berman Academy, square footage, pool, nearby playground.
- Distance card with a global walk/drive toggle to Kemp Mill Synagogue, Berman Academy, and the closest Metro.

## Editing the data

All content lives in two files, no code changes needed to add or update a building:

- `src/data/housing-properties.json` holds the buildings and their units.
- `src/data/housing-config.json` holds the must-haves, preferences, weights, and labels. Adding a must-have or preference here is a one-line edit; the UI builds itself from this file.

Building photos go in `public/photos/<building-id>/` (committed, not hotlinked). Distance times to the three landmarks should be computed offline and stored on each building so the public site never contains a home address.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321/DMV/
npm run build    # static output in dist/
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the Astro site and publishes it to GitHub Pages. Set the repository Pages source to "GitHub Actions" once (Settings, Pages) for the workflow to take over from the old branch deploy.

## Design and legacy

- `design-notes.md` is the full mobile design specification the UI is built from.
- `legacy/` holds the previous single-file vanilla dashboard, kept for reference. The original family-relocation scoring factors are preserved in the `legacyFactors` block of the config, hidden from the UI but available to switch back on.

## Status
This project is complete and inactive: the relocation housing search it supported is over. It is slated for archiving on GitHub. See the wiki Decision-2026-06-20 page.
