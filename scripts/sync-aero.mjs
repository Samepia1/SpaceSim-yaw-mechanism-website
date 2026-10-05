#!/usr/bin/env node
/**
 * Publishes the FSAE aero dashboard (fsae-aero-explorer/dist) at /FSAE/Aero-data.
 *
 *   node scripts/sync-aero.mjs
 *
 * Re-run whenever the dashboard export changes, then commit public/FSAE/Aero-data.
 * fsae-aero-explorer/dist stays the untouched source.
 *
 * WHY THE URLS ARE REWRITTEN: the export uses relative URLs (style.css, app.js,
 * data.json, sources/*.csv). Next strips trailing slashes, so the page is served
 * at /FSAE/Aero-data and those would resolve against /FSAE/ and 404. Absolute
 * paths work with or without the slash. next.config.ts maps the directory URL to
 * index.html.
 */
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'fsae-aero-explorer', 'dist');
const BASE = '/FSAE/Aero-data/';
const OUT = path.join(ROOT, 'public', ...BASE.split('/').filter(Boolean));

// [file, relative reference, absolute replacement]. Every entry must match, so a
// re-export that changes its layout fails here instead of shipping a blank page.
const REWRITES = [
  ['index.html', 'href="style.css"', `href="${BASE}style.css"`],
  ['index.html', 'src="app.js"', `src="${BASE}app.js"`],
  ['app.js', "fetch('data.json')", `fetch('${BASE}data.json')`],
  ['data.json', '"url":"sources/', `"url":"${BASE}sources/`],
];

await rm(OUT, { recursive: true, force: true });
await cp(SRC, OUT, { recursive: true });

for (const [file, from, to] of REWRITES) {
  const p = path.join(OUT, file);
  const text = await readFile(p, 'utf8');
  if (!text.includes(from)) throw new Error(`${file}: expected to find ${from}`);
  await writeFile(p, text.replaceAll(from, to));
}

console.log(`synced ${path.relative(ROOT, SRC)} -> ${path.relative(ROOT, OUT)}`);
