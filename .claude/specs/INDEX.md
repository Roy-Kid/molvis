# Specs Index

Active runtime specs. `/mol:spec` adds an entry here; `/mol:impl` ticks the
spec's tasks off and prunes the entry (and file) on completion.

| Spec | Status | Summary |
|------|--------|---------|
| _No active specs._ | | |

## Shipped batches

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
