# Specs Index

Active runtime specs. `/mol:spec` adds an entry here; `/mol:impl` ticks the
spec's tasks off and prunes the entry (and file) on completion.

| Spec | Status | Summary |
|------|--------|---------|
| [app-abstraction-sink](app-abstraction-sink.md) | open | Sink the engine-neutral App (Command/events/settings) into core; stage + sketch both become Apps; plugin becomes the facade |

## Shipped batches

### 2026-07-31 — close backlog + product polish

- **scene-modifier-iron-law** — closed (A6 agent-auto: analyses stay left catalog)
- **stage-commit-scene** — closed (criteria verified)
- **package-split-core-stage** — closed
- **shared-element-picker-01..04** — closed

### 2026-07-30 — OVITO parity matrix

- **ovito-parity-01-matrix** — full OVITO↔MolVis gap matrix (no Python/Voronoi) + inventory test
- **ovito-parity-02-replicate-unwrap** — P0 Replicate + Unwrap trajectories
- **ovito-parity-03-compute-freeze** — Compute property + Freeze property
- **ovito-parity-04-edit-types-overlap** — Edit types + Select overlapping
- **ovito-parity-05-displacement** — Displacement vectors columns
- **ovito-parity-06-viz-p1b** — Coordination polyhedra, trajectory lines, construct surface mesh
- **ovito-parity-07-p2** — Smooth trajectory, SSAO settings, Edit lattice UX

### 2026-07-30 — OVITO Selection parity

- **ovito-modifier-align** — Clear / Invert / Select Type / Expand Selection (+ registry, regression)

### 2026-07-29 — molvis-sketch chain

- **molvis-sketch-01-model** — `@molcrafts/molvis-sketch` graph, history, Frame IO
- **molvis-sketch-02-canvas** — native Canvas SketchBoard + tools
- **molvis-sketch-03-ops** — ChemDraw-level ops (rings, stereo, charge, keymap)
- **molvis-sketch-04-page** — page Builder replaces Kekule with MolvisSketch

### 2026-07-24 — quality + structure

- select-modifier-expression
- trajectory-play-prefetch
- core-app-scene-facade

### 2026-07-24 — roadmap four

- **camera keyframe interpolate** — `KeyframeTrack` + Catmull-Rom / slerp
- **RPC schema single-source** — `RPC_METHODS` / `RPC_PROTOCOL_VERSION` + `rpc.list_methods`
- **artist representation split** — `artist/representation_draw.ts` host/delegate
- **VSCode Structure Outline + Explorer load** — `molvis.outline` tree, `loadInWorkspace`, auto-load when workspace open
