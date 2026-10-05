# CDPR Yaw Mechanism — project site

Companion site to the poster in `../Poster/`. Interactive 3D of both designs, the
mechanism animations scrubbed by scroll, and the real hardware on video.

Next.js (App Router) · react-three-fiber · plain CSS modules · deploys on Vercel.

```bash
npm install
npm run dev          # http://localhost:3000
```

## Routes (samvelkerobyan.xyz)

| Path | What |
| --- | --- |
| `/` | Landing page linking to the projects (`app/page.tsx`) |
| `/Yaw_Mechanism` | This mechanism site (`app/Yaw_Mechanism/page.tsx`) |
| `/FSAE/Aero-data` | FSAE aero dashboard, a standalone static export |

The FSAE dashboard's source is `fsae-aero-explorer/` (see its README). It is
published into `public/FSAE/Aero-data/` by `node scripts/sync-aero.mjs`, which
also turns its relative asset URLs into absolute ones. Re-run that after changing
the export and commit the result. `next.config.ts` rewrites the directory URL to
its `index.html`.

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

`public/models/prototype.glb` (0.13 MB) and `public/models/fullscale.glb` (1.72 MB),
built from the SolidWorks glTF exports in `../Poster/Assets/`:

```bash
node scripts/optimize-glb.mjs "../Poster/Assets/Small Scale Payload full/Small_scale.glb" prototype
node scripts/optimize-glb.mjs "../Poster/Assets/Final Payload/Payload_Iteration.glb"      fullscale
```

The full-scale export is **60.55 MB / 1.32 M triangles**, and it compresses to 1.72 MB
losslessly — 345 meshes turn out to be only **116 distinct geometries**, so dedup
alone removes 60% of the triangles before Draco even runs. Nothing is decimated.

For the record, the bulk is *not* fasteners: 52% of all triangles is 12 instances of
`2x2 MAXTube - Thick Grid Pattern All Sides`, the frame extrusion, whose thousands of
tessellated grid holes cost ~57k triangles each.

### Why the script avoids `gltf-transform optimize`

`optimize` is a catch-all and two of its passes break this site. Both are asserted
against at the end of the script, which exits non-zero if either reappears:

- **`instance`** rewrites repeated parts as `EXT_mesh_gpu_instancing` — one draw call
  with per-instance transforms. The exploded view moves parts by writing node
  positions, which instanced parts no longer have. It quietly took 345 part nodes
  down to 313.
- **`palette`** bakes materials into a texture atlas. Here it collapsed **48 distinct
  base colours into one white**, flattening the orange motor and green PCB into
  uniform plastic.

So the pipeline is just `dedup` → `prune` → `draco`.

The Draco decoder is **self-hosted** in `public/draco/` (copied from
`node_modules/three/examples/jsm/libs/draco/gltf/`) rather than fetched from a Google
CDN at runtime.

### Exploded view: pick the right level of the hierarchy

The two exports have different shapes, and "explode every mesh" is wrong for both:

```
full scale   Payload Iteration -> 60 children, one being `ODrive Kit.step`
                                  which alone holds 286 meshes — every SMD
                                  component on the S1 driver board, from STEP
prototype    Small_scale -> one child -> 23 mesh children
```

Exploding every mesh would spray ~230 resistors and capacitors across the scene on
one model and move nothing at all on the other. `findAssemblyRoot` therefore descends
while a node has exactly one child **that contains geometry**, and explodes that
node's children.

The "contains geometry" part is load-bearing: SolidWorks exports a node literally
named `current camera` that holds no camera and no mesh, just a translation. An
`isCamera` test does not see it, so the root looked like it had two children, the
descent stopped immediately, and the whole assembly became a single part with zero
offset — the slider silently did nothing.

The explosion is also computed **in world space** and converted back through each
node's cached parent inverse. Offsetting `node.position` by a world-space distance
instead would be wrong under any parent scale, which CAD exports often carry.

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

It also reports any 404s.

Worth checking by hand as well: both videos in **Chrome and Firefox** (the HEVC
regression), the explode slider and pinch-zoom **by touch**, and
`prefers-reduced-motion: reduce`, which replaces scrubbing with a single still.

**When driving the explode slider from a test, use `locator.fill()` or the keyboard,
not a synthetic `input` event.** React's controlled-input value tracker swallows
dispatched events, so the slider moves visually while state never updates — which
looks exactly like a broken explode. In dev, `window.__explode` exposes the computed
pieces so a test can assert on real world positions instead of reading back WebGL
pixels (which do not reliably reflect changes).

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
