# DMV
Rental housing finder tool for DMV relocation.

## Primary App
- Main entry: `family-housing-dashboard.html`
- Legacy references kept: `pindex.html`, `gindex.html`

## Data Sources
- Properties dataset: `housing-properties.json`
- Config and UX defaults: `housing-config.json`
- Data contract (preferred): `housing-schema.json`
- Backward-compatible schema alias: `housing-scheme.json`

## Run Locally
Serve the folder with a static server so JSON fetch calls work:

```bash
cd /workspaces/DMV
python -m http.server 8000
```

Then open `http://localhost:8000/family-housing-dashboard.html`.
