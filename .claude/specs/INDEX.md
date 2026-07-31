# Specs Index

Active runtime specs. `/mol:spec` adds an entry here; `/mol:impl` ticks the
spec's tasks off and prunes the entry (and file) on completion.

| Spec | Status | Summary |
|------|--------|---------|
| [scene-modifier-iron-law](scene-modifier-iron-law.md) | in-progress | Scene-changing modifiers vs left Analysis; left config for surfaces/voids; molrs visual sync |
| [stage-commit-scene](stage-commit-scene.md) | code-complete | Git-like working tree vs molrs HEAD; commitScene/discardScene; analysis waits for commit |
| [package-split-core-stage](package-split-core-stage.md) | code-complete | Split shared `core` (molrs face) / `stage` 3D / sketch 2D / umbrella `@molcrafts/molvis` |
| [shared-element-picker-01-core](shared-element-picker-01-core.md) | code-complete | Add the single native periodic-table picker and layout catalog to shared core |
| [shared-element-picker-02-sketch](shared-element-picker-02-sketch.md) | code-complete | Reuse the core picker in the standalone Sketch surface |
| [shared-element-picker-03-page](shared-element-picker-03-page.md) | code-complete | Reuse the core picker in both 2D and 3D page edit surfaces |
| [shared-element-picker-04-stage](shared-element-picker-04-stage.md) | code-complete | Reuse the core picker in Stage's native edit context menu |

## Shipped batches

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
