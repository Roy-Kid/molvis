import type { PlotlyModule } from "../../src/charts/plotly_loader";

export interface FakeCall {
  method: string;
  args: unknown[];
}

export interface FakePlotly {
  module: PlotlyModule;
  calls: FakeCall[];
  fireClick: (
    div: HTMLElement,
    points: Array<{
      curveNumber: number;
      pointIndex: number;
      x: number;
      y: number;
      customdata?: unknown;
    }>,
  ) => void;
  /** How many traces are currently mounted on a div (from last newPlot/react). */
  traceCount: (div: HTMLElement) => number;
  /** Returns last layout passed to newPlot/react/relayout for a div. */
  lastLayout: (div: HTMLElement) => Record<string, unknown> | undefined;
}

export function createFakePlotly(): FakePlotly {
  const calls: FakeCall[] = [];
  const handlers = new WeakMap<
    HTMLElement,
    Map<string, Array<(e: unknown) => void>>
  >();
  const traceCounts = new WeakMap<HTMLElement, number>();
  const layouts = new WeakMap<HTMLElement, Record<string, unknown>>();

  const ensureHandlerMap = (div: HTMLElement) => {
    let m = handlers.get(div);
    if (!m) {
      m = new Map();
      handlers.set(div, m);
    }
    return m;
  };

  const wireDivMethods = (div: HTMLElement) => {
    const d = div as HTMLElement & {
      on?: (ev: string, cb: (e: unknown) => void) => void;
      removeAllListeners?: (ev: string) => void;
    };
    if (!d.on) {
      d.on = (ev: string, cb: (e: unknown) => void) => {
        const m = ensureHandlerMap(div);
        const arr = m.get(ev) ?? [];
        arr.push(cb);
        m.set(ev, arr);
      };
      d.removeAllListeners = (ev: string) => {
        const m = ensureHandlerMap(div);
        m.delete(ev);
      };
    }
  };

  const fake = {
    newPlot: async (
      div: HTMLElement,
      traces: unknown,
      layout: Record<string, unknown>,
      cfg?: Record<string, unknown>,
    ) => {
      calls.push({ method: "newPlot", args: [div, traces, layout, cfg] });
      wireDivMethods(div);
      traceCounts.set(div, Array.isArray(traces) ? traces.length : 0);
      layouts.set(div, layout);
      return div;
    },
    react: async (
      div: HTMLElement,
      traces: unknown,
      layout: Record<string, unknown>,
      cfg?: Record<string, unknown>,
    ) => {
      calls.push({ method: "react", args: [div, traces, layout, cfg] });
      wireDivMethods(div);
      traceCounts.set(div, Array.isArray(traces) ? traces.length : 0);
      layouts.set(div, layout);
      return div;
    },
    restyle: async (div: HTMLElement, update: unknown, traces: unknown) => {
      calls.push({ method: "restyle", args: [div, update, traces] });
    },
    extendTraces: async (
      div: HTMLElement,
      update: unknown,
      traces: unknown,
      max?: number,
    ) => {
      calls.push({ method: "extendTraces", args: [div, update, traces, max] });
    },
    relayout: async (div: HTMLElement, layout: Record<string, unknown>) => {
      calls.push({ method: "relayout", args: [div, layout] });
      const prev = layouts.get(div) ?? {};
      layouts.set(div, { ...prev, ...layout });
    },
    purge: (div: HTMLElement) => {
      calls.push({ method: "purge", args: [div] });
    },
    Plots: {
      resize: (div: HTMLElement) => {
        calls.push({ method: "Plots.resize", args: [div] });
      },
    },
  };

  return {
    module: fake as unknown as PlotlyModule,
    calls,
    fireClick: (div, points) => {
      const cbs = handlers.get(div)?.get("plotly_click") ?? [];
      for (const cb of cbs) cb({ points });
    },
    traceCount: (div) => traceCounts.get(div) ?? 0,
    lastLayout: (div) => layouts.get(div),
  };
}

/** Filter calls by method name. */
export function callsTo(calls: FakeCall[], method: string): FakeCall[] {
  return calls.filter((c) => c.method === method);
}
