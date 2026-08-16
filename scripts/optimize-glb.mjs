#!/usr/bin/env node
/**
 * Shrinks a SolidWorks glTF export to something sane to serve.
 *
 *   node scripts/optimize-glb.mjs ~/Downloads/Payload\ Iteration.glb fullscale
 *   node scripts/optimize-glb.mjs ~/Downloads/Small_scale.glb        prototype
 *
 * Writes public/models/<name>.glb and reports the before/after size.
 *
 * SolidWorks exports are tessellated for rendering, not for the web: a full
 * assembly with modelled fastener threads routinely lands in the tens of
 * megabytes. This runs gltf-transform's `optimize`, which welds vertices,
 * deduplicates meshes, prunes unused nodes and applies Draco compression.
 *
 * It deliberately does NOT flatten or join meshes: the exploded-view slider needs
 * every part to stay a separate node.
 */
import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const [src, name] = process.argv.slice(2);
if (!src || !name) {
  console.error('usage: node scripts/optimize-glb.mjs <input.glb> <prototype|fullscale>');
  process.exit(1);
}
if (!existsSync(src)) {
  console.error(`not found: ${src}`);
  process.exit(1);
}

const outDir = path.join(ROOT, 'public', 'models');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${name}.glb`);

const before = (await stat(src)).size;
console.log(`in   ${path.basename(src)}  ${(before / 1e6).toFixed(2)} MB`);

await run('npx', [
  '--yes', '@gltf-transform/cli', 'optimize', src, out,
  '--compress', 'draco',
  '--texture-compress', 'webp',
  // Keep the node hierarchy: the explode animation needs separate parts.
  '--join', 'false',
  '--flatten', 'false',
  '--simplify', 'false',
], { maxBuffer: 1 << 26 });

const after = (await stat(out)).size;
console.log(`out  public/models/${name}.glb  ${(after / 1e6).toFixed(2)} MB  ` +
            `(${(100 - (after / before) * 100).toFixed(0)}% smaller)`);

if (after > 15e6) {
  console.log(
    '\nStill large. The usual cause is modelled fastener threads. Re-export with\n' +
    'screws/nuts/washers suppressed and coarse tessellation, or add --simplify true\n' +
    '--simplify-ratio 0.5 to decimate (which will soften edges).'
  );
}
console.log('\nDraco needs its decoder at runtime; @react-three/drei loads it from a CDN,');
console.log('so the first model load requires network access to unpkg.');
