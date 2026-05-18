---
slug: core-charts
status: code-complete
created: 2026-05-18
revised: 2026-05-18
---

# Spec: core-charts

## Summary

Wrap `plotly.js` in `core/` as **framework-agnostic chart primitives**
(`LineChart`, `ScatterChart`) and expose them only through a dedicated
`@molcrafts/molvis-core/charts` subpath export. Downstream apps (`page/`,
`vsc-ext/`, future hosts) consume the wrapper, never plotly directly. The
main entry stays plotly-free so a host that does not import the charts
subpath gets zero plotly bytes in its bundle.

First adoption: migrate `page/src/ui/layout/PCATool.tsx` off raw plotly
onto `ScatterChart`. Style stays pixel-identical (same margins, font
size, transparent canvas, sidebar palette).

This is the foundation for a future TensorBoard-like real-time metrics
panel in `page/`. That panel itself is **out of scope** for this spec —
only the line-chart primitive it will eventually mount is delivered here.

## Motivation

Today plotly is owned by `page/` and called from `PCATool.tsx` via
hand-rolled lazy loading, ad-hoc layout literals, and untyped `as
unknown as` casts (`PCATool.tsx:476–502`). The pattern does not
generalise: a second chart (line plot of energy vs frame, RMSD vs frame,
…) would copy/paste another ~150 lines of plotly glue and reinvent the
sidebar-tuned styling already encoded in `PCATool`.

Two principles drive the wrapper:

1. **Plotly is an implementation detail.** Downstream code should never
   need to know that plotly exists. Swapping plotly for uPlot or
   ECharts later should change one folder, not every consumer.
2. **Cost-on-demand.** A host that only renders the 3D viewer (the
   common case for the Jupyter and VSCode webviews when charts are
   off) should not pay the plotly bytes. Subpath-exports plus lazy
   `import()` of plotly gives both runtime and bundler the freedom to
   drop it.

## Scope

### In scope

- New module `core/src/charts/` with `LineChart`, `ScatterChart`, a
  shared lazy `plotly_loader`, theme primitives, and types.
- `./charts` subpath export from `@molcrafts/molvis-core`; **not**
  re-exported from the main `index.ts`.
- Single source of truth for the categorical 20-entry palette and the
  sidebar-tight plotly layout (margins, font, transparent bg).
- Plotly migrates from `page/`'s `dependencies` to `core/`'s
  `dependencies`. Still loaded via dynamic `import("plotly.js-dist-min")`
  inside the loader — no top-level static import anywhere.
- `PCATool.tsx` rewritten to use `ScatterChart`: same UX (click → seek,
  frame-change → highlight move, ResizeObserver reflow) but the
  lifecycle code is a few useEffect lines around `new ScatterChart()` /
  `chart.dispose()`.
- Path alias `@molvis/core/charts` in `page/tsconfig.json` and
  `page/rsbuild.config.ts`.
- Unit tests for `LineChart` streaming/window semantics and
  `ScatterChart` highlight + click event.
- Bundle-size guard: a smoke build of `import { mountMolvis } from
  "@molcrafts/molvis-core"` contains zero plotly identifiers.

### Out of scope

- Building the TensorBoard-style live-metrics panel in `page/` (a
  follow-up spec once metric ingress is defined).
- Streaming metric pipeline from the Python backend over WebSocket.
- React-component wrapper shipped from `core/` (core is React-free; a
  React adapter is unnecessary — `useEffect` calls the imperative
  class directly).
- Replacing plotly with a different chart engine.
- Charts in `vsc-ext/` (no current consumer).
- Multi-pane / synchronised charts / brushing-and-linking — the API
  must not preclude this but does not deliver it.

## Domain basis

Not applicable — pure rendering wrapper, no domain physics.

## Design

### Layer placement

`core/src/charts/` is a **sibling** of `core/src/ui/`, not a child of
it. `core/src/ui/` holds BabylonJS-GUI mode panels which live inside
the WebGL canvas; charts are DOM-mounted plotly. They share the "core
delivers framework-agnostic UI primitives" philosophy but have
different runtimes and importing one must not pull the other.

```
core/src/
  charts/            ← new, exported as @molcrafts/molvis-core/charts
  ui/                ← existing, in-canvas BabylonJS GUI
```

### Public API

```ts
// core/src/charts/types.ts

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface LineSeriesConfig {
  id: string;
  label?: string;
  color?: string;          // defaults to theme.palette[index]
  initialPoints?: SeriesPoint[];
}

export interface AxisConfig {
  label?: string;
  type?: "linear" | "log";
  range?: [number, number];
}

export interface LineChartConfig {
  series: LineSeriesConfig[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  /** Sliding window in points per series. null = unbounded (default). */
  windowSize?: number | null;
  /** Modebar visible. Default false to match sidebar density. */
  modebar?: boolean;
  /** Light/dark; defaults to "auto" which observes <html class="dark">. */
  theme?: "light" | "dark" | "auto";
}

export interface LineChartClickEvent {
  seriesId: string;
  index: number;
  x: number;
  y: number;
}

export class LineChart {
  constructor(container: HTMLElement, config: LineChartConfig);
  setSeries(id: string, points: SeriesPoint[]): void;
  appendPoint(id: string, point: SeriesPoint): void;
  appendPoints(id: string, points: SeriesPoint[]): void;
  clear(id?: string): void;                          // clear one or all
  setWindow(maxPoints: number | null): void;
  setAxisRange(axis: "x" | "y", range: [number, number] | "auto"): void;
  resize(): void;
  dispose(): void;
  onPointClick(cb: (e: LineChartClickEvent) => void): () => void;
}
```

```ts
// core/src/charts/types.ts (cont.)

export interface ScatterPoint {
  x: number;
  y: number;
  customdata?: unknown;
}

export interface ScatterMarkerConfig {
  size?: number;
  /** Either a single color, per-point array, or numeric column. */
  color?: string | string[] | number[];
  colorscale?: string;
  showscale?: boolean;
}

export interface ScatterChartConfig {
  points: ScatterPoint[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  marker?: ScatterMarkerConfig;
  highlight?: { index: number };   // optional ring overlay
  theme?: "light" | "dark" | "auto";
}

export interface ScatterClickEvent {
  index: number;
  x: number;
  y: number;
  customdata?: unknown;
}

export class ScatterChart {
  constructor(container: HTMLElement, config: ScatterChartConfig);
  /** Partial update; recomputes only fields supplied. */
  update(partial: Partial<ScatterChartConfig>): void;
  setHighlight(index: number | null): void;
  resize(): void;
  dispose(): void;
  onPointClick(cb: (e: ScatterClickEvent) => void): () => void;
}
```

```ts
// core/src/charts/theme.ts

export const CHART_PALETTE: readonly string[]; // 20-entry categorical
export const CHART_DEFAULT_COLOR: string;       // "#60a5fa"

export interface ChartTheme {
  background: "transparent";
  font: { size: number; color: string };
  axis: { gridColor: string; tickColor: string };
  palette: readonly string[];
}
export function resolveTheme(
  mode: "light" | "dark" | "auto",
): ChartTheme;
```

```ts
// core/src/charts/plotly_loader.ts

export type PlotlyModule = typeof import("plotly.js-dist-min");
export function loadPlotly(): Promise<PlotlyModule>;  // cached singleton
```

```ts
// core/src/charts/index.ts

export { LineChart } from "./line_chart";
export { ScatterChart } from "./scatter_chart";
export {
  CHART_PALETTE,
  CHART_DEFAULT_COLOR,
  resolveTheme,
  type ChartTheme,
} from "./theme";
export type {
  SeriesPoint,
  LineSeriesConfig,
  AxisConfig,
  LineChartConfig,
  LineChartClickEvent,
  ScatterPoint,
  ScatterMarkerConfig,
  ScatterChartConfig,
  ScatterClickEvent,
} from "./types";
```

### Tree-shaking strategy

| Mechanism                              | Effect                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| `./charts` subpath export only         | Main entry has no symbolic reference to charts; never traversed.   |
| `core/src/index.ts` does NOT re-export | Same — enforced in code review and in C1 below.                    |
| Dynamic `import("plotly.js-dist-min")` | Plotly chunk is never pulled when chart subpath is unused.         |
| `sideEffects` unchanged                | Charts files contain only class definitions; not in allowlist.    |
| `rslib` `bundle: false` + `entry: "./src/**"` | Auto-produces `dist/charts/{index,line_chart,...}.js`.       |

### Plotly loader

```ts
let _cache: Promise<PlotlyModule> | null = null;
export function loadPlotly() {
  if (!_cache) _cache = import("plotly.js-dist-min");
  return _cache;
}
```

Single shared promise; first chart instance triggers it, subsequent
instances reuse. No top-level reference, so the bundle splitter places
plotly in a side chunk.

### Theme defaults (locks visual parity with current PCATool)

Layout partial returned by `resolveTheme()`:

```ts
{
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor:  "rgba(0,0,0,0)",
  font: { size: 10 },
  margin: { l: 40, r: 10, t: 10, b: 40 },
  showlegend: false,
  hovermode: "closest",
  dragmode: "pan",
}
```

Plotly config partial:

```ts
{
  displayModeBar: false,
  scrollZoom: true,
  responsive: true,
}
```

Both are *defaults* — chart configs can override via `xAxis.range`,
etc. The palette migrates verbatim from `PCATool.tsx:43–64`.

### Streaming semantics (LineChart)

- `appendPoint(id, p)` is the hot-path; calls `Plotly.extendTraces`
  with the single point, optionally capping with `maxPoints` so old
  samples drop. This is the plotly-native streaming primitive — no
  full re-render per append.
- `setWindow(null)` removes the cap.
- `setSeries(id, points)` does a full `Plotly.restyle` of `x`/`y` for
  that trace; used on trajectory-change or stream reset.
- `resize()` calls `Plotly.Plots.resize`. The chart instance owns an
  internal `ResizeObserver`; `resize()` exists as an escape hatch for
  hosts that need to force one.

### Highlight overlay (ScatterChart)

Implemented as a second trace at index `1` with a single point and a
hollow ring marker — same shape as the current PCATool code at
`PCATool.tsx:443–456`. `setHighlight(i)` restyles trace `1` with `x:
[[xs[i]]], y: [[ys[i]]]`; `null` hides it.

### Migration of PCATool

The current ~150-line plotly lifecycle in `PCATool.tsx:405–596`
collapses to roughly:

```tsx
useEffect(() => {
  if (!plotDiv || !pcaResult || !app) return;
  const chart = new ScatterChart(plotDiv, {
    points,
    xAxis: { label: axes[0] },
    yAxis: { label: axes[1] },
    marker: buildMarker(colorBy, pcaResult, app.system.trajectory),
    highlight: { index: app.system.trajectory.currentIndex ?? 0 },
  });
  const offClick = chart.onPointClick((e) => {
    if (typeof e.customdata === "number") app.seekFrame(e.customdata);
  });
  const offFrame = app.events.on("frame-change", (i) =>
    chart.setHighlight(i),
  );
  return () => {
    offClick();
    offFrame();
    chart.dispose();
  };
}, [app, plotDiv, pcaResult, colorBy, axes]);
```

The `buildMarker` helper stays local to `PCATool.tsx` for now (it
maps domain meaning — frame index, cluster id, label — to plotly
marker config). It is *not* in `core/charts/` because that mapping is
domain-specific.

### Package & alias updates

`core/package.json`:

```jsonc
{
  "exports": {
    ".":            { "types": "./dist/index.d.ts",       "import": "./dist/index.js" },
    "./io":         { "types": "./dist/io/index.d.ts",    "import": "./dist/io/index.js" },
    "./io/formats": { "types": "./dist/io/formats.d.ts",  "import": "./dist/io/formats.js" },
    "./charts":     { "types": "./dist/charts/index.d.ts", "import": "./dist/charts/index.js" }
  },
  "dependencies": {
    "@babylonjs/core": "^7.52.2",
    "@babylonjs/gui": "^7.52.2",
    "@babylonjs/inspector": "^7.52.2",
    "@babylonjs/materials": "^7.52.2",
    "@molcrafts/molrs": "^0.0.12",
    "plotly.js-dist-min": "^3.5.0",
    "tslog": "^4.9.3"
  },
  "devDependencies": {
    "@types/plotly.js-dist-min": "^2.3.4",
    /* …existing… */
  },
  "sideEffects": [
    "./src/commands/*.ts",
    "./dist/commands/*.js"
  ]
}
```

`core/rslib.config.ts` — add `plotly.js-dist-min` to `externals` so
the lib entry does not inline it. `tsconfig.json` paths already cover
`@molvis/core/*`, no change.

`page/tsconfig.json` and `page/rsbuild.config.ts` — add an alias for
`@molvis/core/charts → ../core/src/charts/index.ts`. Drop
`plotly.js-dist-min` and `@types/plotly.js-dist-min` from
`page/package.json`.

## Files

### New

- `core/src/charts/index.ts`
- `core/src/charts/line_chart.ts`
- `core/src/charts/scatter_chart.ts`
- `core/src/charts/plotly_loader.ts`
- `core/src/charts/theme.ts`
- `core/src/charts/types.ts`
- `core/tests/charts/line_chart.test.ts`
- `core/tests/charts/scatter_chart.test.ts`

### Modified

- `core/package.json` — add `./charts` export, move plotly into deps,
  add `@types/plotly.js-dist-min` to devDeps.
- `core/rslib.config.ts` — add `plotly.js-dist-min` to `externals`.
- `page/package.json` — remove plotly direct deps.
- `page/tsconfig.json` — add `@molvis/core/charts` path.
- `page/rsbuild.config.ts` — add matching alias.
- `page/src/ui/layout/PCATool.tsx` — replace plotly lifecycle with
  `ScatterChart` instance; delete `loadPlotly`, `PlotlyModule`,
  plotly-specific `useEffect`s; keep `buildMarker` and descriptor
  logic intact.

## Tasks

- [x] **`core:scaffold-charts`** — Create `core/src/charts/`
   `{index,types,theme,plotly_loader}.ts` with public exports. Add
   `./charts` subpath to `core/package.json` exports and add plotly
   to `core/`'s deps + externals.
- [x] **`core:implement-line-chart`** — Implement `LineChart` with
   `setSeries`, `appendPoint(s)`, `clear`, `setWindow`, `setAxisRange`,
   `resize`, `dispose`, `onPointClick`. Internal `ResizeObserver`.
- [x] **`core:implement-scatter-chart`** — Implement `ScatterChart`
   with `update`, `setHighlight`, `resize`, `dispose`, `onPointClick`.
   Second trace for highlight ring overlay.
- [x] **`core:tests`** — `tests/charts/line_chart.test.ts` (13
   cases) + `tests/charts/scatter_chart.test.ts` (8 cases) using an
   injected fake plotly. 21 chart tests added; full core suite 394
   tests passing.
- [x] **`page:alias-charts`** — Added `@molvis/core/charts` to
   `page/tsconfig.json`, `page/rsbuild.config.ts`, and
   `vsc-ext/tsconfig.json` (vsc-ext's `@/*` alias makes it
   transitively typecheck PCATool).
- [x] **`page:migrate-pca-tool`** — Three plotly-tied useEffects
   (~190 lines) collapsed into a single ScatterChart lifecycle
   (~45 lines). `loadPlotly`/`PlotlyModule` deleted; categorical
   palette + solid colour reused from `@molvis/core/charts`.
- [x] **`page:drop-plotly-dep`** — `plotly.js-dist-min` and
   `@types/plotly.js-dist-min` removed from `page/package.json`.
   Plotly now resolves transitively through `core`; root hoist
   confirmed.
- [x] **`verify:tree-shake`** — `core/dist/index.js` contains zero
   `plotly` identifiers. Page bundle places the full ~4.4 MB plotly
   library in async chunk `409.*.js` reachable only via dynamic
   import; main `index.*.js` only contains the lightweight chart
   class bodies that reference plotly by string literal.
- [x] **`verify:lint-typecheck-test`** — `npm run typecheck` clean
   across `core/`, `page/`, `vsc-ext/`. Biome clean on all 10 new /
   touched chart files. `npm run test:core` green (394 passing).

## Testing

- **Unit (rstest, mocked plotly)**:
  - LineChart: construct → assert `loadPlotly` called once; `appendPoint`
    routes to `Plotly.extendTraces`; `setWindow(10)` plus 15 appends
    leaves the trace with 10 points; `dispose()` purges the div and
    detaches all listeners.
  - ScatterChart: construct → assert two traces created (main + hidden
    highlight); `setHighlight(3)` restyles trace `1`; click handler
    fires with correct `customdata`; `dispose()` clears.
- **Manual smoke (dev:page)**:
  - Open PCA analysis option, pick all descriptors, click Compute.
  - Click a scatter point → timeline jumps to that frame index.
  - Drag the timeline slider → highlight marker tracks the current
    frame.
  - Resize the right sidebar → chart reflows without flicker.
  - Toggle theme light/dark (if wired) → palette and axes recolor.
- **Bundle inspection**: `grep -i plotly core/dist/index.js` returns
  empty. `npm run build:page` produces a chunk containing plotly only
  reachable from the dynamic import.

## Risks & mitigations

| Risk                                                              | Mitigation                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Plotly types leak into core's main `.d.ts`                        | Loader returns `Promise<PlotlyModule>` but the chart classes' public API uses only project-owned types. `@types/plotly.js-dist-min` stays in devDeps. |
| Tree-shake breaks if a future commit re-exports charts from `core/src/index.ts` | Acceptance C1 forbids it; reviewer checks during `/molvis-review`.       |
| Style drift between LineChart and existing sidebar density        | Theme module is the single source; PCATool migration freezes parity against the current visual. |
| Plotly version bump introduces breaking API                       | `loadPlotly` returns the typed module; one edit point.                           |

## Out of scope (deferred)

- TensorBoard-like live metrics panel in `page/`.
- Backend metric streaming over WebSocket.
- React-component wrappers from `core/`.
- Brushing-and-linking between scatter and line charts.
- Replacing plotly with another engine.
- Vsc-ext chart integration.
