# Notes

Passive memory for MolVis. `/mol:note` syncs decisions here; every agent reads
recent entries for context.

## 2026-07-30 — left compute / right draw (analysis-nature modifiers)

**UX iron law (extends scene-modifier placement):**

1. **Pipeline modifiers that are analysis-nature** (structure order, density
   surfaces, vector fields, isosurfaces, …) register `usesLeftConfig: true`.
2. On **add or select**, open the left advanced panel with
   `surface="compute"` (algorithm params + recompute).
3. Pipeline bottom properties show `surface="draw"` only (colors, isovalue,
   opacity, arrow scale, …) — not a dead stub.
4. **Pure Analysis catalog** (charts) stays left-only. If the analysis can
   also drive the canvas, offer a button to **add a right-side pipeline
   modifier** (e.g. Cluster → Color by Property on `cluster_id`).

Do not put chart-only RDF/MSD into the pipeline. Do not put full dual forms on
both left and right.

## 2026-07-30 — single scene path (Empty Scene always)

**Invariant — form and path are unique.**

1. Open / reset always has a **length-1 trajectory** on `System` and **≥1
   DataSourceModifier** at the pipeline head (primary = Empty Scene memory
   source: `sourceType: "empty"`, filename `"Empty Scene"`).
2. There is **no** parallel “no DS / paint without composition” mode.
3. Every ingress operates on that path:
   `DataSource(s) → compose → transforms → draws`.
   - File **replace** → sole primary DS + System share the loaded trajectory.
   - File **augment** → additional DS; primary never disappears.
   - Sketch / edit **commit** → write frame into primary trajectory HEAD.
   - Manual box / Wrap PBC / analysis → read/write working `frame` from
     composition (manual box writes `frame.box`).
4. Removing the last DS reinstalls Empty Scene (never zero sources).
5. Implementation: `stage/src/pipeline/empty_scene.ts`, boot via
   `SceneSession.bootstrapEmptyPrimary()` in `MolvisApp` constructor + `reset`.

Do **not** reintroduce loaders or demos that `pipeline.clear()` without
reinstalling a primary, or `setTrajectory` paths that leave the pipeline empty.

## 2026-07-30 — package naming lock

- Shared molrs gateway, pure primitives, and framework-free shared custom elements:
  workspace **`core/`** (`@molcrafts/molvis-core`, not a consumer-facing product).
- 2D: **`sketch/`** → `@molcrafts/molvis-sketch`.
- 3D: **`stage/`** (today still mostly under `core/`) → `@molcrafts/molvis-stage`.
- Umbrella publish: **`@molcrafts/molvis`** (2D+3D).
- Full matrix, rules, migration: [package-architecture.md](./package-architecture.md).

## 2026-07-30 — sketch chrome is package-owned (`gui` flag)

- Icon tool rails (top common · left chem · bottom assoc) live in
  **`sketch/src/ui/SketchComposer`**, not only in `examples/demo.ts` or a React
  reimplementation in page.
- **`gui: true` (default)** mounts chrome; **`gui: false`** is canvas-only /
  host-owned chrome — same idea as stage's `gui` flag.
- Fragment templates (structure-diagram previews, nested category menu) are
  part of that chrome + engine (`fragment` tool, catalog, place command).
- `page` `MolvisSketch` is a thin React host: `new SketchComposer({ gui: true })`
  plus pop-out / generate-3D via **`extraSlot` portal** (no absolute overlay).
- **Theming:** sketch UI colors are tokens only
  (`sketch/src/style/tokens.ts` → `--msk-*`). Chrome CSS defaults and
  canvas theme (`background`/`bondStroke`/`labelFill`/`selectionStroke`)
  all resolve from those vars; page maps the full set in
  `.molvis-sketch-host`. No hard-coded hex in board/renderer/composer.
  Heteroatom ChemDraw labels (`SKETCH_ELEMENT_COLORS`) stay scientific
  data, not product UI tokens. Do **not** rewrite rails in shadcn for
  style parity.

## 2026-07-30 — stage context menu product tokens

- Context menu WCs (`molvis-context-menu`, button/folder/slider/separator) use
  shared `--molvis-ui-*` tokens (shadow DOM inherits from `.molvis-root`).
- Standalone defaults live in `SHARED_CSS` fallbacks (dark gun-metal).
- Page maps popover tokens in `tailwind.css` on `.molvis-root` — same bridge
  pattern as sketch; do not reimplement the menu in React/shadcn.
