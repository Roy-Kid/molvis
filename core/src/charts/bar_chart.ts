import { type PlotlyModule, loadPlotly } from "./plotly_loader";
import { CHART_PALETTE, buildConfig, buildLayout, resolveTheme } from "./theme";
import type { AxisConfig, LegendConfig, ThemeMode } from "./types";

export interface BarPoint {
  x: number | string;
  y: number;
  /** Optional per-bar text used by the default hovertemplate. */
  text?: string;
  /** Optional payload echoed back in ``onBarClick``. */
  customdata?: unknown;
}

export interface BarSeriesConfig {
  id: string;
  label?: string;
  color?: string;
  points: BarPoint[];
  /**
   * Trace type for this series. Defaults to ``"bar"``; ``"line"`` lets
   * an "overlay" series render as a line over stacked / grouped bars
   * (e.g. a "Started" reference line on top of "Succeeded/Failed" bars).
   */
  type?: "bar" | "line";
  /**
   * Plotly hovertemplate per bar; defaults to ``"<b>%{x}</b><br>%{y}"``.
   * When ``points[i].text`` is set, ``%{text}`` is also available.
   */
  hovertemplate?: string;
}

export type BarMode = "stack" | "group" | "overlay";

export interface BarChartConfig {
  series: BarSeriesConfig[];
  /** Default ``"group"`` (side-by-side). */
  mode?: BarMode;
  /** Bar orientation: ``"v"`` (default) draws ``y`` over ``x``; ``"h"`` flips them. */
  orientation?: "v" | "h";
  xAxis?: AxisConfig & { dtype?: "category" | "date" | "linear" };
  yAxis?: AxisConfig & { dtype?: "category" | "date" | "linear" };
  /** Show legend strip. Default false. */
  showLegend?: boolean;
  /** Legend orientation / position overrides; honoured only when ``showLegend`` is true. */
  legend?: LegendConfig;
  /** Modebar visible. Default false. */
  modebar?: boolean;
  /** Plotly modebar buttons to hide when modebar is enabled. */
  modebarRemove?: string[];
  /** Gap between bars in each cluster; mirrors plotly's ``layout.bargap``. */
  bargap?: number;
  theme?: ThemeMode;
  /** ``hovermode``; "x unified" pairs nicely with stacked time bars. */
  hovermode?: "closest" | "x" | "x unified";
}

export interface BarClickEvent {
  seriesId: string;
  index: number;
  x: number | string;
  y: number;
  customdata?: unknown;
}

type ClickListener = (e: BarClickEvent) => void;

interface PlotlyClickPoint {
  curveNumber: number;
  pointIndex: number;
  x: number | string;
  y: number;
  customdata?: unknown;
}

interface PlotlyClickEvent {
  points?: PlotlyClickPoint[];
}

interface PlotlyDiv extends HTMLElement {
  on?: (event: string, cb: (e: unknown) => void) => void;
  removeAllListeners?: (event: string) => void;
}

/**
 * Categorical / time bar chart. Stacking & grouping are picked via
 * ``BarChartConfig.mode``; everything else mirrors {@link LineChart}
 * (lazy plotly, theme observer, resize observer, dispose contract).
 */
export class BarChart {
  private readonly container: PlotlyDiv;
  private config: BarChartConfig;
  private themeMode: ThemeMode;
  private readonly clickListeners = new Set<ClickListener>();
  private plotly: PlotlyModule | null = null;
  private disposed = false;
  private readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private resizeRaf: number | null = null;

  constructor(container: HTMLElement, config: BarChartConfig) {
    this.container = container as PlotlyDiv;
    this.config = config;
    this.themeMode = config.theme ?? "auto";
    this.mountPromise = this.mount();
    this.setupResizeObserver();
    if (this.themeMode === "auto") this.setupThemeObserver();
  }

  ready(): Promise<void> {
    return this.mountPromise;
  }

  async update(partial: Partial<BarChartConfig>): Promise<void> {
    await this.mountPromise;
    if (this.disposed) return;
    this.config = { ...this.config, ...partial };
    if (partial.theme) this.themeMode = partial.theme;
    await this.render();
  }

  async resize(): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    this.plotly.Plots.resize(this.container);
  }

  onBarClick(cb: ClickListener): () => void {
    this.clickListeners.add(cb);
    return () => {
      this.clickListeners.delete(cb);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    this.resizeObserver = null;
    this.themeObserver = null;
    this.clickListeners.clear();
    this.container.removeAllListeners?.("plotly_click");
    this.plotly?.purge(this.container);
  }

  private async mount(): Promise<void> {
    this.plotly = await loadPlotly();
    if (this.disposed) return;
    await this.render();
    if (this.disposed) {
      this.plotly.purge(this.container);
      return;
    }
    this.wireClickEvent();
  }

  private async render(): Promise<void> {
    if (!this.plotly) return;
    const theme = resolveTheme(this.themeMode);
    const orientation = this.config.orientation ?? "v";
    const mode = this.config.mode ?? "group";
    // When stacked, a ``type:'line'`` series should track the cumulative
    // total so the line floats *on top* of the stack rather than getting
    // re-anchored at its own raw y values (plotly's barmode doesn't
    // apply to scatter traces).
    const cumulative: number[] | null =
      mode === "stack"
        ? this.config.series.reduce<number[]>((acc, series) => {
            if ((series.type ?? "bar") !== "bar") return acc;
            series.points.forEach((p, i) => {
              acc[i] = (acc[i] ?? 0) + (p.y ?? 0);
            });
            return acc;
          }, [])
        : null;

    const traces = this.config.series.map((series, i) => {
      const color = series.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
      const seriesType = series.type ?? "bar";
      const categories = series.points.map((p) => p.x);
      const values =
        seriesType === "line" && cumulative
          ? series.points.map((_, idx) => cumulative[idx] ?? 0)
          : series.points.map((p) => p.y);
      const texts = series.points.map((p) => p.text ?? "");
      const customdata = series.points.map((p) => p.customdata);

      const base: Record<string, unknown> = {
        name: series.label ?? series.id,
        text: texts,
        customdata,
        hovertemplate:
          series.hovertemplate ?? "<b>%{x}</b><br>%{y}<extra></extra>",
      };

      if (seriesType === "line") {
        return {
          ...base,
          type: "scatter",
          mode: "lines+markers",
          x: orientation === "h" ? values : categories,
          y: orientation === "h" ? categories : values,
          line: { color, width: 2 },
          marker: { size: 4, color },
        };
      }

      return {
        ...base,
        type: "bar",
        orientation,
        x: orientation === "h" ? values : categories,
        y: orientation === "h" ? categories : values,
        marker: { color },
      };
    });

    const layout = buildLayout(
      theme,
      this.config.xAxis,
      this.config.yAxis,
    ) as Record<string, unknown>;
    layout.barmode = mode;
    layout.showlegend = this.config.showLegend ?? false;
    layout.hovermode = this.config.hovermode ?? "closest";
    if (this.config.bargap !== undefined) layout.bargap = this.config.bargap;
    if (this.config.legend) layout.legend = this.config.legend;

    const xAxis = layout.xaxis as Record<string, unknown>;
    const yAxis = layout.yaxis as Record<string, unknown>;
    if (this.config.xAxis?.dtype) xAxis.type = this.config.xAxis.dtype;
    if (this.config.yAxis?.dtype) yAxis.type = this.config.yAxis.dtype;

    const cfg = buildConfig(this.config.modebar ?? false) as Record<
      string,
      unknown
    >;
    if (this.config.modebarRemove && this.config.modebar) {
      cfg.modeBarButtonsToRemove = this.config.modebarRemove;
    }
    await this.plotly.react(
      this.container,
      traces as unknown as Parameters<PlotlyModule["react"]>[1],
      layout as unknown as Parameters<PlotlyModule["react"]>[2],
      cfg as unknown as Parameters<PlotlyModule["react"]>[3],
    );
  }

  private wireClickEvent(): void {
    const div = this.container;
    if (!div.on) return;
    div.on("plotly_click", (raw: unknown) => {
      const e = raw as PlotlyClickEvent;
      const pt = e.points?.[0];
      if (!pt) return;
      const series = this.config.series[pt.curveNumber];
      if (!series) return;
      for (const cb of this.clickListeners) {
        cb({
          seriesId: series.id,
          index: pt.pointIndex,
          x: pt.x,
          y: pt.y,
          customdata: pt.customdata,
        });
      }
    });
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRaf !== null) return;
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = null;
        if (this.disposed || !this.plotly) return;
        this.plotly.Plots.resize(this.container);
      });
    });
    this.resizeObserver.observe(this.container);
  }

  private setupThemeObserver(): void {
    if (typeof MutationObserver === "undefined") return;
    if (typeof document === "undefined") return;
    this.themeObserver = new MutationObserver(() => {
      if (this.disposed) return;
      this.render();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}
