# @molcrafts/molplot

Plotly-based scientific charting primitives for MolVis — line, scatter, bar,
gantt, and raw chart classes with a shared theme layer and a lazily-loaded
plotly backend.

Split out of `@molcrafts/molvis-core` so consumers that only need charting do
not pull in the babylon.js 3D rendering stack, and so `molvis-core` no longer
carries a plotly dependency.

## Install

```sh
npm install @molcrafts/molplot plotly.js-dist-min
```

`plotly.js-dist-min` is a peer-style runtime dependency (externalized in the
build) and must be installed by the consumer.

## Usage

```ts
import { LineChart, ScatterChart, CHART_PALETTE } from "@molcrafts/molplot";

const chart = new LineChart(container, { themeMode: "auto" });
```

## API

All classes and types previously exported from `@molcrafts/molvis-core/charts`
are now exported from the package root `@molcrafts/molplot`:

- `LineChart`, `ScatterChart`, `BarChart`, `GanttChart`, `RawChart`
- Theme helpers: `CHART_PALETTE`, `CHART_DEFAULT_COLOR`, `resolveTheme`,
  `ChartTheme`
- Config / event / point types for every chart

## License

BSD-3-Clause
