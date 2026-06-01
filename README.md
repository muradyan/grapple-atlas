# 🥋 Grapple Atlas

[grappleatlas.com](https://grappleatlas.com)

An interactive map of Brazilian Jiu-Jitsu (No-Gi) positions and the transitions
between them, rendered **live in 3D**. Pick a position, see every technique that
leaves it, and travel the graph — branch off, drill in, and discover how grappling
connects. Built on the public-domain **[GrappleMap](https://github.com/Eelis/GrappleMap)**
dataset (extracted once into this repo — no network needed at runtime).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (analytics only runs in production)
npm test         # vitest
```

## How it works

- **Start screen** → pick a starting position (8 common standoffs, or search all 588).
- **3D view** (Three.js) — the two grapplers are drawn from GrappleMap's 23-joint
  skeletons; transitions animate using the real keyframes. Drag to orbit, pinch to zoom.
- **Drill-in navigation** — a breadcrumb of your path + the current position's
  transitions as a list; tap one to travel there. Mobile-first (the mat stays pinned).
- **Shareable links** — every position has a hash URL (`#<slug>-<id>`); the Share
  button copies it / opens the native share sheet.

## Data pipeline (offline, `scripts/`, re-runnable)

1. `gm-extract.mjs` — headless-runs GrappleMap's decoder → `scripts/gm-graph.json`.
2. `gm-extract-joints.mjs` — captures per-node joint coords, `swap_players` flags, and
   transition keyframes (`gm-joints.json`, `gm-swaps.json`, `gm-frames.json`).
3. `gm-roles.mjs` — decodes "who's on top" from joint geometry → `p0roles.json`.
4. `gm-build.mjs` — curates the beginner subgraph and writes the app data:
   `src/data/grapplemap.json`, `public/gm-poses.json`, `public/gm-frames.json`.

## Stack

React + TypeScript + Vite + Tailwind + Zustand + Three.js. Optional analytics via
PostHog (production only; set `VITE_POSTHOG_KEY` — see `.env.example`).

Grappling data: **GrappleMap** by Eelis van der Weegen, public domain.
