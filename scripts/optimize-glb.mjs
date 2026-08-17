#!/usr/bin/env node
/**
 * Shrinks a SolidWorks glTF export to something sane to serve.
 *
 *   node scripts/optimize-glb.mjs "<input.glb>" prototype
 *   node scripts/optimize-glb.mjs "<input.glb>" fullscale
 *
 * Writes public/models/<name>.glb, then verifies nothing important was lost.
 *
 * Explicit steps, NOT gltf-transform's `optimize`. `optimize` is a catch-all that
 * also runs two passes this site cannot tolerate:
 *
 *   - `instance` collapses repeated parts into EXT_mesh_gpu_instancing, i.e. one
 *     draw call with per-instance transforms. The exploded view moves parts by
 *     writing node positions, which instanced parts no longer have. On the
 *     full-scale model it silently merged 345 mesh nodes down to 313.
 *   - `palette` bakes per-material colours into a texture atlas. On this model it
 *     turned 48 distinct base colours into a single white one, flattening the
 *     orange motor, the PCB greens and the dark gears into uniform plastic.
 *
 * What is left is entirely lossless: dedup shares identical geometry between
 * instances (this model has 345 meshes but only 116 distinct geometries), prune
 * drops unreferenced junk including the `current camera` node SolidWorks exports,
 * and Draco compresses the vertex data.
 */
import { execFile } from 'node:child_process';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CLI = ['--yes', '@gltf-transform/cli'];

const [src, name] = process.argv.slice(2);
if (!src || !name) {
  console.error('usage: node scripts/optimize-glb.mjs <input.glb> <prototype|fullscale>');
  process.exit(1);
}
if (!existsSync(src)) {
  console.error(`not found: ${src}`);
  process.exit(1);
}

/** Read a GLB's JSON chunk without a full glTF parse. */
async function inspect(file) {
  const buf = await readFile(file);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
  const nodes = json.nodes ?? [];
  const acc = json.accessors ?? [];
  const tris = (json.meshes ?? []).reduce(
    (s, m) => s + (m.primitives ?? []).reduce(
      (t, p) => t + (p.indices != null ? acc[p.indices].count / 3 : 0), 0), 0);
  const colours = new Set(
    (json.materials ?? []).map((m) =>
      (m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).map((v) => v.toFixed(2)).join(','))
  );
  return {
    bytes: buf.length,
    nodes: nodes.length,
    partNodes: nodes.filter((n) => n.mesh != null).length,
    meshes: (json.meshes ?? []).length,
    materials: (json.materials ?? []).length,
    colours: colours.size,
    tris: Math.round(tris),
    ext: json.extensionsUsed ?? [],
  };
}

const outDir = path.join(ROOT, 'public', 'models');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${name}.glb`);
const tmpA = path.join(outDir, `.${name}.dedup.glb`);
const tmpB = path.join(outDir, `.${name}.prune.glb`);

const before = await inspect(src);
console.log(`in   ${path.basename(src)}`);
console.log(`     ${(before.bytes / 1e6).toFixed(2)} MB · ${before.partNodes} part nodes · ` +
            `${before.tris.toLocaleString()} tris · ${before.materials} materials ` +
            `(${before.colours} distinct colours)`);

const step = async (label, args) => {
  process.stdout.write(`  ${label.padEnd(8)}`);
  await run('npx', [...CLI, ...args], { maxBuffer: 1 << 26 });
  console.log('done');
};

await step('dedup', ['dedup', src, tmpA]);
await step('prune', ['prune', tmpA, tmpB]);
await step('draco', ['draco', tmpB, out]);
await rm(tmpA, { force: true });
await rm(tmpB, { force: true });

const after = await inspect(out);
console.log(`\nout  public/models/${name}.glb`);
console.log(`     ${(after.bytes / 1e6).toFixed(2)} MB · ${after.partNodes} part nodes · ` +
            `${after.tris.toLocaleString()} tris · ${after.materials} materials ` +
            `(${after.colours} distinct colours)`);
console.log(`     ${(100 - (after.bytes / before.bytes) * 100).toFixed(0)}% smaller · ` +
            `${after.meshes} meshes (was ${before.meshes}; geometry now shared)`);

// The two regressions this script exists to prevent.
let bad = false;
if (after.partNodes !== before.partNodes) {
  console.log(`\nFAIL part nodes changed ${before.partNodes} -> ${after.partNodes}. ` +
              `Something merged or instanced parts; the exploded view needs one node per part.`);
  bad = true;
}
if (after.colours < before.colours) {
  console.log(`\nFAIL distinct colours dropped ${before.colours} -> ${after.colours}. ` +
              `A palette/material merge has flattened the model's appearance.`);
  bad = true;
}
if (after.ext.some((e) => e.includes('instancing'))) {
  console.log(`\nFAIL EXT_mesh_gpu_instancing present; parts can no longer be moved individually.`);
  bad = true;
}
if (!bad) console.log('\nOK   parts, colours and hierarchy all preserved.');

if (after.bytes > 15e6) {
  console.log('\nStill large. Consider simplifying only the heaviest family ' +
              '(on the full-scale model that is the MAXTube extrusion, ~52% of triangles).');
}
process.exit(bad ? 1 : 0);
