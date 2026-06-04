# 🥋 Grapple Atlas

**[grappleatlas.com](https://grappleatlas.com)**

An interactive map of Brazilian Jiu-Jitsu (No-Gi) positions and the transitions
between them, rendered **live in 3D**. Pick a position, see every technique that
leaves it, and travel the graph — branch off, drill in, and discover how grappling
connects.

The atlas currently covers **588 positions** linked by **1,212 transitions**,
all running locally in the browser (no backend, no network calls at runtime).

## What you can do

- **Start anywhere** — pick one of 8 common standing/ground starts, or search the
  full set of 588 positions.
- **Explore in 3D** — the two grapplers are drawn from real 23-joint skeletons and
  transitions animate from real keyframes. Drag to orbit, pinch/scroll to zoom.
- **Drill in & branch off** — each position lists every transition that leaves it;
  tap one to travel there. A breadcrumb tracks the path you've taken.
- **Share any position** — every position has its own hash URL (`#<slug>-<id>`);
  the Share button copies the link or opens the native share sheet.
- **Mobile-first** — the mat stays pinned and the controls are built for touch.

## Where the data comes from

Grapple Atlas is built on **[GrappleMap](https://github.com/Eelis/GrappleMap)** by
Eelis van der Weegen — a community-built database of interconnected grappling
positions and transitions, **released into the public domain**.

The dataset is extracted **once, offline** into this repo (see the pipeline below),
so the app ships with all its data baked in and needs no server at runtime.

## Run

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (tsc + vite)
npm run preview  # serve the production build locally
npm test         # vitest
npm run lint     # eslint
```

## How it works

- **Start screen** → pick a starting position (8 common starts, or search all 588).
- **3D view** (Three.js) — grapplers rendered from GrappleMap's 23-joint skeletons;
  transitions animate using the real keyframes.
- **Drill-in navigation** — a breadcrumb of your path plus the current position's
  outgoing transitions as a tappable list.
- **Shareable links** — every position maps to a hash URL; deep links restore state.

## Data pipeline (offline, `scripts/`, re-runnable)

The app data is regenerated from GrappleMap by running these in order:

1. `gm-extract.mjs` — headless-runs GrappleMap's decoder → `scripts/gm-graph.json`.
2. `gm-extract-joints.mjs` — captures per-node joint coords, `swap_players` flags,
   and transition keyframes (`gm-joints.json`, `gm-swaps.json`, `gm-frames.json`).
3. `gm-roles.mjs` — decodes "who's on top" from joint geometry → `p0roles.json`.
4. `gm-build.mjs` — curates the beginner subgraph and writes the app data:
   `src/data/grapplemap.json`, `public/gm-poses.json`, `public/gm-frames.json`.

## Stack

React 19 + TypeScript + Vite + Tailwind + Zustand + Three.js.

Optional analytics via PostHog (production builds only; set `VITE_POSTHOG_KEY` —
see `.env.example`). With no key set, analytics is a complete no-op.

## Hosting & deployment

Hosted on **Cloudflare Pages** as a static SPA. Every push to `main` triggers the
GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the app and deploys `dist/` via `wrangler`. SPA routing falls back to
`index.html` through `public/_redirects`.

Deployment relies on three repository secrets (Settings → Secrets and variables →
Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the optional
`VITE_POSTHOG_KEY`.

## Credits

Grappling data: **GrappleMap** by Eelis van der Weegen — public domain.
