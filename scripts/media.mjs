#!/usr/bin/env node
/**
 * Builds every static media asset the site serves, from the SolidWorks renders
 * and lab footage in ../3d modelling stuff/ and ../Poster/Assets/.
 *
 *   node scripts/media.mjs            # everything
 *   node scripts/media.mjs frames     # just the scrub sequences
 *   node scripts/media.mjs video      # just the transcodes
 *
 * WHY THIS IS A MANUAL STEP: Vercel's build image has no ffmpeg, so none of this
 * can run at deploy time. Output goes into public/ and is committed to the repo
 * as ordinary static assets. Re-run it only when a source clip changes.
 *
 * Two source clips are turned into FRAME SEQUENCES because they reveal something
 * progressively and get scrubbed by scroll; two are transcoded to VIDEO because
 * they are camera moves / real footage that a viewer expects to just play.
 */
import { execFile } from 'node:child_process';
import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const LAB = path.resolve(ROOT, '..');
const PUB = path.join(ROOT, 'public');

const V5 = path.join(LAB, '3d modelling stuff', 'V5');
const SMALL = path.join(LAB, '3d modelling stuff', 'Small Scale Payload full');
const POSTER_ASSETS = path.join(LAB, 'Poster', 'Assets');

/** Scroll-scrubbed sequences. `frames` is the count sampled evenly across the clip. */
const SEQUENCES = [
  {
    name: 'prototype',
    src: path.join(SMALL, 'Small_scale_animation_try.mp4'),
    frames: 120,
    width: 1100,
  },
  {
    name: 'assembly',
    src: path.join(V5, 'Third_Clip.mp4'),
    frames: 140,
    width: 1100,
  },
];

/**
 * Normal-playback video. `lab` is HEVC in the source, which only decodes in
 * Safari - transcoding it is required for Chrome/Firefox, not an optimisation.
 */
const VIDEOS = [
  {
    name: 'fullscale-demo',
    src: path.join(V5, 'ARDC Final Payload Demo.mp4'),
    height: 720,
  },
  {
    name: 'lab',
    src: path.join(POSTER_ASSETS, 'Payload_Lab_2.mp4'),
    height: 720,
  },
];

const fmtMB = (b) => `${(b / 1e6).toFixed(2)} MB`;

async function dirSize(dir) {
  let total = 0;
  for (const f of await readdir(dir)) total += (await stat(path.join(dir, f))).size;
  return total;
}

async function probe(src) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_frames,codec_name',
    '-show_entries', 'format=duration',
    '-of', 'json', src,
  ]);
  const j = JSON.parse(stdout);
  const s = j.streams[0];
  return {
    width: s.width,
    height: s.height,
    codec: s.codec_name,
    nbFrames: Number(s.nb_frames) || null,
    duration: Number(j.format.duration),
  };
}

async function buildSequence(seq) {
  if (!existsSync(seq.src)) {
    console.log(`  SKIP (missing): ${path.basename(seq.src)}`);
    return;
  }
  const out = path.join(PUB, 'frames', seq.name);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const info = await probe(seq.src);
  // Sample `frames` images evenly over the clip by forcing an output frame rate
  // rather than using select= expressions: fps is exact and cheap, and the clip
  // is a fixed-duration render so even spacing is what we want.
  const fps = seq.frames / info.duration;

  await run('ffmpeg', [
    '-v', 'error',
    '-i', seq.src,
    '-vf', `fps=${fps.toFixed(6)},scale=${seq.width}:-2:flags=lanczos`,
    '-frames:v', String(seq.frames),
    // q 72 keeps the white background clean without banding on the grey shading
    '-c:v', 'libwebp', '-quality', '72', '-compression_level', '6',
    path.join(out, '%04d.webp'),
  ], { maxBuffer: 1 << 26 });

  const files = (await readdir(out)).filter((f) => f.endsWith('.webp')).sort();
  const bytes = await dirSize(out);
  console.log(
    `  frames/${seq.name.padEnd(10)} ${String(files.length).padStart(3)} frames  ` +
    `${seq.width}px  ${fmtMB(bytes)}  (${(bytes / files.length / 1024).toFixed(0)} KB/frame)  ` +
    `<- ${path.basename(seq.src)} ${info.width}x${info.height} ${info.duration.toFixed(1)}s`
  );
  return { name: seq.name, count: files.length, bytes };
}

async function buildVideo(v) {
  if (!existsSync(v.src)) {
    console.log(`  SKIP (missing): ${path.basename(v.src)}`);
    return;
  }
  const out = path.join(PUB, 'video');
  await mkdir(out, { recursive: true });
  const info = await probe(v.src);

  const mp4 = path.join(out, `${v.name}.mp4`);
  await run('ffmpeg', [
    '-v', 'error', '-i', v.src,
    '-vf', `scale=-2:${v.height}:flags=lanczos`,
    '-an',                                  // no audio anywhere on this site
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '23', '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',              // lets playback start before full download
    '-y', mp4,
  ], { maxBuffer: 1 << 26 });

  // VP9 fallback: smaller than H.264 and universally decodable in Chrome/Firefox.
  // (AV1 would be smaller still but encodes far too slowly to be worth it here.)
  const webm = path.join(out, `${v.name}.webm`);
  await run('ffmpeg', [
    '-v', 'error', '-i', v.src,
    '-vf', `scale=-2:${v.height}:flags=lanczos`,
    '-an',
    '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1',
    '-y', webm,
  ], { maxBuffer: 1 << 26 });

  // Poster frame so the element is never a blank box before play.
  const poster = path.join(out, `${v.name}-poster.webp`);
  await run('ffmpeg', [
    '-v', 'error', '-ss', (info.duration * 0.25).toFixed(2), '-i', v.src,
    '-frames:v', '1', '-vf', `scale=-2:${v.height}:flags=lanczos`,
    '-c:v', 'libwebp', '-quality', '78', '-y', poster,
  ]);

  let [a, b] = [(await stat(mp4)).size, (await stat(webm)).size];

  // Only keep the VP9 copy when it is actually smaller. H.264 already plays in
  // every browser, so a larger WebM alongside it is pure download waste - and on
  // CAD renders with big flat white areas VP9 sometimes loses outright.
  let keptWebm = true;
  if (b >= a) {
    await rm(webm, { force: true });
    keptWebm = false;
  }

  console.log(
    `  video/${v.name.padEnd(16)} mp4 ${fmtMB(a)}  ` +
    (keptWebm ? `webm ${fmtMB(b)} (preferred)` : `webm dropped (${fmtMB(b)} > mp4)`) +
    `  <- ${path.basename(v.src)} ${info.codec} ${info.width}x${info.height} ${info.duration.toFixed(1)}s`
  );
  if (info.codec === 'hevc') {
    console.log(`      (source was HEVC - Safari-only - so this transcode is required, not optional)`);
  }
  return { name: v.name, bytes: a + (keptWebm ? b : 0), webm: keptWebm };
}

const what = process.argv[2] ?? 'all';
console.log('Building site media...\n');

const totals = [];
if (what === 'all' || what === 'frames') {
  console.log('Scrub sequences (drawn to canvas on scroll):');
  for (const s of SEQUENCES) totals.push(await buildSequence(s));
  console.log('');
}
if (what === 'all' || what === 'video') {
  console.log('Video (normal playback):');
  for (const v of VIDEOS) totals.push(await buildVideo(v));
  console.log('');
}

// Manifest so the client knows frame counts without hard-coding them in two places.
const seqDirs = existsSync(path.join(PUB, 'frames'))
  ? await readdir(path.join(PUB, 'frames'), { withFileTypes: true })
  : [];
const manifest = {};
for (const d of seqDirs) {
  if (!d.isDirectory()) continue;
  const files = (await readdir(path.join(PUB, 'frames', d.name))).filter((f) => f.endsWith('.webp'));
  manifest[d.name] = { count: files.length, ext: 'webp', pad: 4 };
}
if (Object.keys(manifest).length) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(PUB, 'frames', 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote public/frames/manifest.json  ${JSON.stringify(manifest)}\n`);
}

const grand = totals.filter(Boolean).reduce((n, t) => n + t.bytes, 0);
console.log(`Total committed media: ${fmtMB(grand)}`);
console.log('All of it is fetched lazily per section, so none of it is in the initial load.');
