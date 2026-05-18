---
slug: core-charts
status: code-complete
---

# Acceptance: core-charts

Binding "done" contract for `/mol:impl` (or `/molvis-impl`). Every
criterion below must pass before the spec is considered complete.

## C1 — Charts subpath exists and is isolated

**type:** code · **status:** verified · **last_checked:** 2026-05-18

- `@molcrafts/molvis-core/charts` is resolvable in TypeScript and at
  runtime from `page/` (typecheck green; `core/dist/charts/index.js`
  present).
- Exports from the subpath: `LineChart`, `ScatterChart`,
  `CHART_PALETTE`, `CHART_DEFAULT_COLOR`, `resolveTheme`, plus public
  type aliases per the spec.
- `core/src/index.ts` has **no** import from `./charts`. Grep on
  `core/dist/index.d.ts` for `LineChart|ScatterChart|CHART_PALETTE`
  returns empty.

## C2 — Plotly is lazy and isolated

**type:** code · **status:** verified · **last_checked:** 2026-05-18

- Only `core/src/charts/plotly_loader.ts` references
  `"plotly.js-dist-min"`: once as `import type * as PlotlyT`
  (erased at runtime) and once as `import("plotly.js-dist-min")`
  (dynamic).
- `page/src/ui/layout/PCATool.tsx` has zero references to `plotly`,
  `Plotly`, or `plotly.js-dist-min`.

## C3 — Page no longer depends on plotly directly

**type:** code · **status:** verified · **last_checked:** 2026-05-18

- `page/package.json` lists neither `plotly.js-dist-min` nor
  `@types/plotly.js-dist-min`.
- `core/package.json` lists `plotly.js-dist-min` under
  `dependencies` and `@types/plotly.js-dist-min` under
  `devDependencies`.
- `npm install` at workspace root succeeds; plotly is hoisted to
  the root `node_modules/`; `page/node_modules/plotly.js-dist-min`
  is absent (resolves transitively).

## C4 — Tree-shake proof

**type:** performance · **status:** verified · **last_checked:** 2026-05-18

- `npm run build:core` →  `core/dist/index.js` contains zero
  plotly identifiers (`grep -i plotly` empty).
- `npm run build:page` → plotly's full ~4.4 MB lives in async chunk
  `409.*.js` reachable only via dynamic `import("plotly.js-dist-min")`.
  The main `index.*.js` chunk's single "plotly" hit is the
  `"plotly_click"` string literal inside our wrapper class — not the
  plotly library.

## C5 — PCATool parity in dev:page

**type:** ui_runtime · **status:** pending · **last_checked:** 2026-05-18

Requires runtime evaluation. Drive `npm run dev:page`, open the PCA
analysis option, and verify:

- Compute renders the scatter; tooltip shows `frame #N\n<x>, <y>`.
- Click-on-point seeks to that frame index.
- Timeline scrub moves the highlight ring marker.
- Sidebar resize reflows the chart without lag spike.
- Visual: margins / font / transparent bg unchanged from prior build.

`hovertemplate` and theme defaults are wired through `ScatterChart`
config; palette and solid colour are imported from
`@molvis/core/charts`. Static checks for parity pass; only a live
browser confirms no regression.

## C6 — LineChart smoke

**type:** ui_runtime · **status:** pending · **last_checked:** 2026-05-18

Requires runtime evaluation. A LineChart smoke harness (transient
route in `npm run dev:core` or a small `core/examples/`
demo page) must demonstrate:

- 100 points appended at 20 ms intervals without flicker.
- `setWindow(50)` causes only the most recent 50 samples to remain.
- `dispose()` cleanly removes the chart from the DOM.

Unit tests prove the buffer-management invariants; live render
behaviour is left for a follow-up runtime check.

## C7 — Tests and lint

**type:** runtime · **status:** verified · **last_checked:** 2026-05-18

- `npm run test:core` passes (394 tests, includes 21 new chart
  tests).
- `npm run typecheck` clean across `core/`, `page/`, `vsc-ext/`.
- Biome clean on all 10 new / touched chart files (project-wide
  `npm run lint` exit code 0; pre-existing `.venv` warnings are
  config-scope, not code).

## C8 — Style parity captured in code

**type:** code · **status:** verified · **last_checked:** 2026-05-18

- `CHART_PALETTE` in `core/src/charts/theme.ts` matches the
  previous `CATEGORICAL_PALETTE` in `PCATool.tsx` by value and order
  (20 entries, `#1f77b4` first, `#9edae5` last).
- `buildLayout()` default returns `margin:{l:40,r:10,t:10,b:40}`,
  `font.size:10`, `paper_bgcolor:"rgba(0,0,0,0)"`,
  `plot_bgcolor:"rgba(0,0,0,0)"`.
- `buildConfig()` default returns `displayModeBar:false`,
  `scrollZoom:true`, `responsive:true`.

## Out of scope — explicitly NOT criteria

- A live TensorBoard panel mounted in `page/`.
- Backend metric streaming over WebSocket.
- React-component wrappers (`<LineChart />` JSX) from `core/`.
- vsc-ext chart integration.
- Replacing plotly with another engine.
