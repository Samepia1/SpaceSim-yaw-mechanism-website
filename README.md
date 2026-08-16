# CDPR Yaw Mechanism — project site

Companion site to the poster in `../Poster/`. Interactive 3D of both designs, the
mechanism animations scrubbed by scroll, and the real hardware on video.

Next.js (App Router) · react-three-fiber · plain CSS modules · deploys on Vercel.

```bash
npm install
npm run dev          # http://localhost:3000
```

---

## The one thing to understand first

**Vercel's build image has no ffmpeg**, so no media can be generated at deploy
time. Frames and transcodes are produced locally by `scripts/media.mjs` and
**committed to the repo** as ordinary static assets in `public/`.

Consequence: after changing a source clip you must re-run the script and commit
its output, or the deployed site keeps serving the old media.

```bash
node scripts/media.mjs          # everything (slow: VP9 encoding)
node scripts/media.mjs frames   # just the scrub sequences
node scripts/media.mjs video    # just the transcodes
```

Sources live outside this folder, in `../3d modelling stuff/` and
`../Poster/Assets/`. They are **not** part of this repo — the script reads them
from disk. Anyone cloning this repo gets the committed output, not the sources.

Current committed media is about **17 MB**, all lazily fetched per section, so
none of it is in the initial page load.

### Why some clips are scrubbed and some just play

| Asset | Treatment | Reason |
|---|---|---|
| `frames/prototype/` | scroll-scrubbed | reveals the mechanism progressively |
| `frames/assembly/` | scroll-scrubbed | an assembly sequence — scrubbing *is* the point |
| `video/fullscale-demo` | plays | a camera move with captions rendered into it |
| `video/lab` | plays | real 120 fps footage; scrubbing real video looks wrong |

Scrubbing is done by **drawing pre-extracted frames to a canvas**, not by seeking
`video.currentTime`. iOS Safari throttles seeks, requires a user gesture before it
will decode, and stutters between keyframes. Most visitors arrive by scanning a QR
code on a phone, so that failure mode would hit the majority of them.

`scripts/media.mjs` also drops the VP9 copy whenever it comes out **larger** than
the H.264 one, which happens on CAD renders with large flat white areas. H.264
plays everywhere, so a bigger WebM beside it is pure download waste.

`video/lab` is transcoded from **HEVC**, which decodes only in Safari. That
transcode is required for the clip to appear in Chrome or Firefox at all.

---

## 3D models

`public/models/prototype.glb` and `public/models/fullscale.glb`. Until they exist
the viewers render a labelled placeholder, so the layout can be worked on without
them — a `HEAD` request decides, because a 404 inside `<Suspense>` would otherwise
take the whole section down.

Export from SolidWorks: **File → Save As → glTF Binary (.glb)** (2021 or newer).

What matters for web performance, more than it does for a render:

- **Suppress or hide fasteners** — screws, nuts, washers. Modelled threads produce
  enormous triangle counts for detail nobody can see in a browser. This is usually
  the difference between a 4 MB and a 60 MB file.
- **Coarse or medium tessellation**, not fine.
- **Keep the assembly tree** — do not save as one merged body. The exploded-view
  slider moves each part node independently, so a single merged mesh cannot explode.

Then shrink it:

```bash
node scripts/optimize-glb.mjs ~/Downloads/Small_scale.glb prototype
node scripts/optimize-glb.mjs ~/Downloads/Payload\ Iteration.glb fullscale
```

### How the exploded view works

No authored metadata. Each mesh's direction comes from its own bounding-box centre
relative to the assembly centre, with the horizontal component damped — these
assemblies are built around a vertical yaw axis, so a purely radial explosion
throws the stacked gears and bearings sideways into each other, while biasing
upward separates them the way the poster's exploded drawings do. Tune with the
`spread` prop per viewer.

---

## Verifying

```bash
npm run build && npx next start -p 3111 &
node scripts/verify.mjs
```

Checks the two things a build cannot catch on its own:

1. **Horizontal overflow at phone width.** One nested grid can widen the page and
   silently clip every line of text off the right edge. It happened during this
   build: a single-column `.split` with an implicit `auto` track let the nested
   `.specs` grid resolve `auto-fit` against max-content, forcing the column 46 px
   wider than the viewport. Invisible in a screenshot of the left-hand side, which
   is why this check exists. Hence `grid-template-columns: minmax(0, 1fr)`.
2. **That each sequence actually scrubs**, by hashing the canvas at five scroll
   positions and requiring distinct frames — rather than showing frame 1 forever.

It also reports 404s, ignoring the `.glb`s while those are still unexported.

Worth checking by hand as well: both videos in **Chrome and Firefox** (the HEVC
regression), the explode slider and pinch-zoom **by touch**, and
`prefers-reduced-motion: reduce`, which replaces scrubbing with a single still.

---

## Layout

One codebase, two compositions, switched on **aspect ratio and min width** rather
than width alone:

```css
@media (min-width: 900px) and (min-aspect-ratio: 4 / 3) { ... }
```

so a phone held sideways keeps the phone composition instead of being handed a
split-pane it has no height for.

- **Portrait** — single column, full-bleed figures, one idea per screen.
- **Landscape** — prose beside the figure, figure pinned while the text scrolls.

Light-only by design: every animation frame and CAD render is on white, so figures
sit on the page with no visible edge. A dark theme would mean re-rendering all the
media.

---

## Deploying

The repo is initialised locally but has no remote. To publish:

```bash
# create an empty repo on GitHub first (no README, no .gitignore), then:
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then on vercel.com → **Add New → Project → Import** that repo. Framework detection
and build settings need no changes. Every push deploys after that, with a preview
URL per branch.

**Point the poster QR at the first successful deploy, not at a finished site.** A
`*.vercel.app` URL exists as soon as the first deploy succeeds, and the poster
needs a URL before it goes to print. `../Poster/build/plots/make_assets.py`
regenerates the code:

```bash
# from ../Poster/build
POSTER_QR_URL="https://your-project.vercel.app" ./render.sh
```
