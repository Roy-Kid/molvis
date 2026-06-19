import { loadPlotly, type PlotlyModule } from "./plotly_loader";
import {
  buildConfig,
  buildLayout,
  CHART_DEFAULT_COLOR,
  resolveTheme,
} from "./theme";
import type { ScatterChartConfig, ScatterClickEvent, ThemeMode } from "./types";

type ClickListener = (e: ScatterClickEvent) => void;

interface PlotlyClickPoint {
  curveNumber: number;
  pointIndex: number;
  x: number;
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

export class ScatterChart {
  private readonly container: PlotlyDiv;
  private config: ScatterChartConfig;
  private themeMode: ThemeMode;
  private readonly clickListeners = new Set<ClickListener>();
  private plotly: PlotlyModule | null = null;
  private disposed = false;
  private readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private resizeRaf: number | null = null;

  constructor(container: HTMLElement, config: ScatterChartConfig) {
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

  async update(partial: Partial<ScatterChartConfig>): Promise<void> {
    await this.mountPromise;
    if (this.disposed) return;
    this.config = { ...this.config, ...partial };
    if (partial.theme) this.themeMode = partial.theme;
    await this.render();
  }

  async setHighlight(index: number | null): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    if (index === null) {
      await this.plotly.restyle(
        this.container,
        { x: [[]], y: [[]] } as unknown as Parameters<
          PlotlyModule["restyle"]
        >[1],
        [1],
      );
      return;
    }
    const p = this.config.points[index];
    if (!p) return;
    await this.plotly.restyle(
      this.container,
      { x: [[p.x]], y: [[p.y]] } as unknown as Parameters<
        PlotlyModule["restyle"]
      >[1],
      [1],
    );
  }

  async resize(): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    this.plotly.Plots.resize(this.container);
  }

  onPointClick(cb: ClickListener): () => void {
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
    const points = this.config.points;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const customdata = points.map((p) => p.customdata);
    const marker = this.config.marker ?? {};

    const mainTrace: Record<string, unknown> = {
      type: "scattergl",
      mode: "markers",
      x: xs,
      y: ys,
      customdata,
      marker: {
        size: marker.size ?? 6,
        color: marker.color ?? CHART_DEFAULT_COLOR,
        colorscale: marker.colorscale,
        showscale: marker.showscale ?? false,
      },
      hovertemplate:
        this.config.hovertemplate ?? "%{x:.3f}, %{y:.3f}<extra></extra>",
      name: "points",
    };

    const highlight = this.config.highlight;
    const hasHighlight =
      highlight !== undefined &&
      highlight.index >= 0 &&
      highlight.index < points.length;
    const highlightTrace: Record<string, unknown> = {
      type: "scattergl",
      mode: "markers",
      x: hasHighlight && highlight ? [points[highlight.index].x] : [],
      y: hasHighlight && highlight ? [points[highlight.index].y] : [],
      marker: {
        size: 14,
        line: { width: 2, color: "white" },
        color: "rgba(0,0,0,0)",
      },
      hoverinfo: "skip",
      showlegend: false,
      name: "highlight",
    };

    const layout = buildLayout(theme, this.config.xAxis, this.config.yAxis);
    const cfg = buildConfig(this.config.modebar ?? false);

    await this.plotly.react(
      this.container,
      [mainTrace, highlightTrace] as unknown as Parameters<
        PlotlyModule["react"]
      >[1],
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
      // Only fire for clicks on the main trace (curve 0), not the highlight overlay.
      if (pt.curveNumber !== 0) return;
      for (const cb of this.clickListeners) {
        cb({
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
