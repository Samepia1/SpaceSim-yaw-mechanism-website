#!/usr/bin/env node
/**
 * Browser checks that a build cannot catch on its own.
 *
 *   npx next start -p 3111 &   # or npm run dev
 *   node scripts/verify.mjs
 *
 * 1. Horizontal overflow at phone width. A single nested grid can widen the page
 *    and silently clip every line of text off the right edge; that happened once
 *    already and is invisible in a screenshot of the left-hand side.
 * 2. That each scrub sequence actually advances frames as you scroll, rather
 *    than showing frame 1 forever.
 * 3. Console/page errors, and which assets 404.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL ?? 'http://localhost:3111/Yaw_Mechanism';
const browser = await chromium.launch();
let failures = 0;

const report = (ok, msg) => {
  if (!ok) failures++;
  console.log(`  [${ok ? 'ok ' : 'FAIL'}] ${msg}`);
};

// ---------------------------------------------------------------- overflow ---
for (const v of [
  { n: 'phone portrait', w: 390, h: 844, mobile: true },
  { n: 'landscape', w: 1440, h: 900, mobile: false },
]) {
  const pg = await browser.newPage({
    viewport: { width: v.w, height: v.h },
    isMobile: v.mobile,
    hasTouch: v.mobile,
  });
  const missing = [];
  pg.on('response', (r) => {
    if (r.status() === 404) missing.push(new URL(r.url()).pathname);
  });
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));

  await pg.goto(SITE, { waitUntil: 'load' });
  await pg.waitForTimeout(1000);

  const o = await pg.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > vw + 1 || b.left < -1) {
        // Ignore anything an ancestor clips - it cannot affect the page width.
        let clipped = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'hidden' || ov === 'clip') { clipped = true; break; }
        }
        if (!clipped) bad.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]);
      }
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, bad: [...new Set(bad)] };
  });

  console.log(`\n${v.n} (${v.w}x${v.h})`);
  report(o.scrollWidth <= o.vw + 1,
    `no horizontal overflow (scrollWidth ${o.scrollWidth} vs viewport ${o.vw})`);
  report(o.bad.length === 0, `nothing unclipped crosses the viewport edge ${o.bad.length ? JSON.stringify(o.bad.slice(0, 5)) : ''}`);
  report(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors.slice(0, 2)) : ''}`);
  const unexpected = missing.filter((p) => !p.endsWith('.glb'));
  report(unexpected.length === 0,
    `no unexpected 404s ${unexpected.length ? JSON.stringify([...new Set(unexpected)]) : ''}`);
  const glbs = [...new Set(missing.filter((p) => p.endsWith('.glb')))];
  if (glbs.length) console.log(`         note: models not exported yet -> ${glbs.join(', ')} (placeholder shown)`);
  await pg.close();
}

// ------------------------------------------------------------------- scrub ---
console.log('\nscrub sequences');
{
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await pg.goto(SITE, { waitUntil: 'load' });
  await pg.waitForTimeout(800);

  const tracks = await pg.evaluate(() =>
    [...document.querySelectorAll('canvas[data-scrub]')].map((c) => {
      const track = c.parentElement.parentElement;
      const r = track.getBoundingClientRect();
      return { name: c.dataset.scrub, top: r.top + window.scrollY, height: r.height };
    })
  );

  for (let t = 0; t < tracks.length; t++) {
    const sigs = [];
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const y = tracks[t].top + (tracks[t].height - 800) * f;
      await pg.evaluate((yy) => window.scrollTo(0, yy), y);
      await pg.waitForTimeout(1500);
      sigs.push(
        await pg.evaluate((i) => {
          const c = document.querySelectorAll('canvas[data-scrub]')[i];
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let h = 0;
          for (let k = 0; k < d.length; k += 4001) h = (h * 31 + d[k]) % 1e9;
          return h;
        }, t)
      );
    }
    const distinct = new Set(sigs).size;
    report(distinct >= 4, `sequence ${t + 1} (${tracks[t].name}): ${distinct}/5 sampled scroll positions drew a distinct frame`);
  }
  await pg.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures ? 1 : 0);
