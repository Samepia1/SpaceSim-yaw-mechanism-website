# FSAE Aero Explorer

Complete standalone export of the FSAE dashboard built in this conversation.
The browser application and prepared data are identical to the published version.
No framework, npm packages, API keys, database, or build step are required to run it.

## Contents

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Application HTML and navigation |
| `dist/style.css` | Responsive styles |
| `dist/app.js` | All charts, controls, inspectors, and exports |
| `dist/data.json` | Prepared records and original CSV cell values |
| `dist/sources/` | Eight CSV downloads used by the website |
| `raw_data/` | The same eight CSVs under their original filenames |
| `raw_data/manifest.json` | Stable source-file order for regeneration |
| `reference_workbooks/` | Three original Excel uploads for reference; not used by the CSV regeneration script |
| `prepare_data.py` | Portable Python data-preparation script |
| `check.mjs` | Data and rendering-logic checks (not browser screenshot tests) |
| `SHA256SUMS.txt` | Checksums for the packaged files |

## Run locally

From this folder, run:

```bash
python -m http.server 8000 --directory dist
```

Open http://localhost:8000 in your browser. On systems using `python3`, substitute
that command for `python`. Do not open index.html directly with a file:// URL:
the app fetches data.json and needs an HTTP server.

## Add to GitHub

Extract this archive and copy the folder into your repository. The `dist` folder
is already the complete runnable website; it should be committed along with the
code and data. No existing Git history or hosting credentials are included.

For an existing website, copy the CONTENTS of `dist` into that site's static asset
directory for the dashboard. Keep index.html, style.css, app.js, data.json, and the
sources folder together. The application uses relative URLs and can live under a
subdirectory.

### Your requested path

For a Next.js website, a possible placement is:

`public/FSAE/data_visualisation/`

Copy the contents of `dist` there. The explicit static entry point will then be:

`/FSAE/data_visualisation/index.html`

For the shorter URL `/FSAE/data_visualisation/`, configure your existing framework
or host to serve this index.html at that path. Redirect the slashless directory
URL to the version with a trailing slash, or provide an equivalent base-path
configuration so relative assets load from the correct directory. Preserve the
existing site's routing settings; this archive does not overwrite them.

For a separate static-hosting project, choose `dist` as the published directory.
There is no application build command. Connecting a custom hostname does not,
by itself, create a route inside an existing website.

## Regenerate data (optional)

The prepared data is included, so regeneration is not required for deployment.
To rebuild it from the supplied CSV snapshots:

```bash
python prepare_data.py
node check.mjs
```

Python uses only standard-library modules. The check script uses built-in Node.js
modules; use a modern Node.js version with global Blob support, such as Node 20+.
The data script expects this exact set of CSV layouts and contains assertions for
this snapshot. If you add new runs or change columns, update its mapping and
checks instead of assuming that any CSV will be recognized automatically.

## Data handling

- 72 wind-on tunnel points, 15 imported 25 CFD entries, 12 unique 26 CFD report
  filenames, and 5 supplied corrected cases are stored: 104 records total.
- One repeated 25 zero-yaw entry is excluded from plots by default, leaving 103
  plot-eligible records. The original row remains in the source browser.
- Copied 26 report blocks are deduplicated by source filename. They are not
  experimental repeats.
- Wind-tunnel speeds use mph multiplied by 0.44704. CFD uses Simulation Velocity.
- Positive downforce is displayed. Wind-tunnel front share is CLF/(CLF+CLR).
- Efficiency is calculated as positive downforce coefficient divided by drag
  coefficient; original efficiency fields remain accessible.
- Supplied corrected CFD is kept separate from measurements and original CFD.
- The correction-trace calibration speeds are inherited from the earlier workbook
  mapping; CSV alone cannot validate the original formulas.
- The supplied 25/26 design labels do not establish the physical test date.
- Missing/error values are not silently replaced with zero in numerical plots.

## Access and publication

This static export contains no built-in login. The private access of the original
hosted Site was provided by its hosting service and is not part of these files.
Anyone allowed to load a deployed copy can also retrieve its data.json and CSVs.
Use your repository/hosting access settings for the intended audience.

## Checks included

`check.mjs` verifies unique IDs, data counts, source-file presence, coefficient
conversion, 30 combinations of source and view, matching conditions, all record
inspectors, and selected empty-data states. It does not replace a browser layout
and routing check on your eventual deployment.
