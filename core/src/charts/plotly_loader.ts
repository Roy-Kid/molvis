/**
 * Lazy single-shot loader for plotly. The dynamic `import()` is the
 * sole reason `@molcrafts/molvis-core/charts` keeps plotly out of any
 * downstream bundle that does not actually instantiate a chart.
 *
 * The `__setPlotlyForTesting` hook lets unit tests inject a stub that
 * records calls without pulling the real ~3 MB plotly bundle.
 */

import type * as PlotlyT from "plotly.js-dist-min";

export type PlotlyModule = typeof PlotlyT;

let _impl: Promise<PlotlyModule> | null = null;

export function loadPlotly(): Promise<PlotlyModule> {
  if (!_impl) {
    _impl = import("plotly.js-dist-min");
  }
  return _impl;
}

/** Test-only hook. Pass a fake module to inject; pass null to reset. */
export function __setPlotlyForTesting(mod: PlotlyModule | null): void {
  _impl = mod ? Promise.resolve(mod) : null;
}
