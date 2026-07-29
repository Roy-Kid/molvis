# Specs Index

Active runtime specs. `/mol:spec` adds an entry here; `/mol:impl` ticks the
spec's tasks off and prunes the entry (and file) on completion.

| Spec | Status | Summary |
|------|--------|---------|
| [molvis-sketch-01-model](molvis-sketch-01-model.md) | approved | New `@molcrafts/molvis-sketch` package: graph, history, Frame IO |
| [molvis-sketch-02-canvas](molvis-sketch-02-canvas.md) | approved | Native Canvas 2D SketchBoard + atom/bond/select/erase |
| [molvis-sketch-03-ops](molvis-sketch-03-ops.md) | approved | ChemDraw-level ops (rings, stereo, charge, marquee, keymap) |
| [molvis-sketch-04-page](molvis-sketch-04-page.md) | approved | Replace Kekule in page Builder with MolvisSketch + shadcn |

Chain base: **`molvis-sketch`**. Implement in order 01 → 02 → 03 → 04.
Each sub-spec is independently mergeable after predecessors land.

## Shipped batches

### 2026-07-24 — quality + structure

- select-modifier-expression
- trajectory-play-prefetch
- core-app-scene-facade

### 2026-07-24 — roadmap four

- **camera keyframe interpolate** — `KeyframeTrack` + Catmull-Rom / slerp
- **RPC schema single-source** — `RPC_METHODS` / `RPC_PROTOCOL_VERSION` + `rpc.list_methods`
- **artist representation split** — `artist/representation_draw.ts` host/delegate
- **VSCode Structure Outline + Explorer load** — `molvis.outline` tree, `loadInWorkspace`, auto-load when workspace open
