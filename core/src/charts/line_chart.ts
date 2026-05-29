import { loadPlotly, type PlotlyModule } from "./plotly_loader";
import { buildConfig, buildLayout, CHART_PALETTE, resolveTheme } from "./theme";
import type {
  AxisConfig,
  LineChartClickEvent,
  LineChartConfig,
  LineSeriesConfig,
  SeriesPoint,
  ThemeMode,
} from "./types";

type ClickListener = (e: LineChartClickEvent) => void;

interface PlotlyClickPoint {
  curveNumber: number;
  pointIndex: number;
  x: number;
  y: number;
}

interface PlotlyClickEvent {
  points?: PlotlyClickPoint[];
}

interface PlotlyDiv extends HTMLElement {
  on?: (event: string, cb: (e: unknown) => void) => void;
  removeAllListeners?: (event: string) => void;
}

export class LineChart {
  private readonly container: PlotlyDiv;
  private readonly seriesIds: string[];
  private readonly buffers: Map<string, { x: number[]; y: number[] }>;
  private readonly clickListeners = new Set<ClickListener>();
  private readonly seriesConfigs: Map<string, LineSeriesConfig>;
  private windowSize: number | null;
  private modebar: boolean;
  private modebarRemove: string[] | undefined;
  private hovertemplate: string | undefined;
  private hovermode: "closest" | "x" | "x unified" | undefined;
  private showLegend: boolean;
  private themeMode: ThemeMode;
  private xAxis: AxisConfig | undefined;
  private yAxis: AxisConfig | undefined;
  private seriesColors: Map<string, string>;
  private plotly: PlotlyModule | null = null;
  private disposed = false;
  private readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private resizeRaf: number | null = null;

  constructor(container: HTMLElement, config: LineChartConfig) {
    this.container = container as PlotlyDiv;
    this.seriesIds = config.series.map((s) => s.id);
    this.buffers = new Map();
    this.seriesColors = new Map();
    this.seriesConfigs = new Map();
    this.windowSize = config.windowSize ?? null;
    this.modebar = config.modebar ?? false;
    this.modebarRemove = config.modebarRemove;
    this.hovertemplate = config.hovertemplate;
    this.hovermode = config.hovermode;
    this.showLegend = config.showLegend ?? false;
    this.themeMode = config.theme ?? "auto";
    this.xAxis = config.xAxis;
    this.yAxis = config.yAxis;

    config.series.forEach((s, i) => {
      const points = s.initialPoints ?? [];
      this.buffers.set(s.id, {
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
      });
      this.seriesColors.set(
        s.id,
        s.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
      );
      this.seriesConfigs.set(s.id, s);
    });

    this.mountPromise = this.mount(config.series);
    this.setupResizeObserver();
    if (this.themeMode === "auto") this.setupThemeObserver();
  }

  /** Resolves once the initial Plotly.newPlot completes. */
  ready(): Promise<void> {
    return this.mountPromise;
  }

  async setSeries(id: string, points: SeriesPoint[]): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    const idx = this.seriesIds.indexOf(id);
    if (idx < 0) throw new Error(`LineChart: unknown series ${id}`);
    const buf = {
      x: points.map((p) => p.x),
      y: points.map((p) => p.y),
    };
    if (this.windowSize !== null && buf.x.length > this.windowSize) {
      buf.x = buf.x.slice(-this.windowSize);
      buf.y = buf.y.slice(-this.windowSize);
    }
    this.buffers.set(id, buf);
    await this.plotly.restyle(this.container, { x: [buf.x], y: [buf.y] }, [
      idx,
    ]);
  }

  async appendPoint(id: string, point: SeriesPoint): Promise<void> {
    await this.appendPoints(id, [point]);
  }

  async appendPoints(id: string, points: SeriesPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    const idx = this.seriesIds.indexOf(id);
    if (idx < 0) throw new Error(`LineChart: unknown series ${id}`);
    const buf = this.buffers.get(id);
    if (!buf) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    buf.x.push(...xs);
    buf.y.push(...ys);
    if (this.windowSize !== null && buf.x.length > this.windowSize) {
      const drop = buf.x.length - this.windowSize;
      buf.x.splice(0, drop);
      buf.y.splice(0, drop);
    }
    await this.plotly.extendTraces(
      this.container,
      { x: [xs], y: [ys] } as unknown as Parameters<
        PlotlyModule["extendTraces"]
      >[1],
      [idx],
      this.windowSize ?? undefined,
    );
  }

  async clear(id?: string): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    const ids = id ? [id] : this.seriesIds;
    for (const seriesId of ids) {
      const buf = this.buffers.get(seriesId);
      if (!buf) continue;
      buf.x.length = 0;
      buf.y.length = 0;
      const traceIdx = this.seriesIds.indexOf(seriesId);
      if (traceIdx < 0) continue;
      await this.plotly.restyle(this.container, { x: [[]], y: [[]] }, [
        traceIdx,
      ]);
    }
  }

  async setWindow(maxPoints: number | null): Promise<void> {
    this.windowSize = maxPoints;
    if (maxPoints === null) return;
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    // Retroactively trim every series whose buffer exceeds the cap.
    const trimmedTraces: number[] = [];
    const xs: number[][] = [];
    const ys: number[][] = [];
    this.seriesIds.forEach((seriesId, idx) => {
      const buf = this.buffers.get(seriesId);
      if (!buf || buf.x.length <= maxPoints) return;
      const drop = buf.x.length - maxPoints;
      buf.x.splice(0, drop);
      buf.y.splice(0, drop);
      trimmedTraces.push(idx);
      xs.push(buf.x.slice());
      ys.push(buf.y.slice());
    });
    if (trimmedTraces.length > 0) {
      await this.plotly.restyle(
        this.container,
        { x: xs, y: ys },
        trimmedTraces,
      );
    }
  }

  async setAxisRange(
    axis: "x" | "y",
    range: [number, number] | "auto",
  ): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    const key = axis === "x" ? "xaxis.range" : "yaxis.range";
    const value = range === "auto" ? null : range;
    await this.plotly.relayout(this.container, {
      [key]: value,
    } as unknown as Parameters<PlotlyModule["relayout"]>[1]);
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

  private async mount(series: LineSeriesConfig[]): Promise<void> {
    this.plotly = await loadPlotly();
    if (this.disposed) return;
    const theme = resolveTheme(this.themeMode);
    const traces = series.map((s, i) => {
      const buf = this.buffers.get(s.id) ?? { x: [], y: [] };
      const trace: Record<string, unknown> = {
        type: "scattergl",
        mode: s.mode ?? "lines",
        name: s.label ?? s.id,
        x: buf.x.slice(),
        y: buf.y.slice(),
        line: {
          color: this.seriesColors.get(s.id) ?? theme.palette[i],
          width: s.width ?? 2,
        },
      };
      const tpl = s.hovertemplate ?? this.hovertemplate;
      if (tpl !== undefined) trace.hovertemplate = tpl;
      return trace;
    });
    const layout = buildLayout(theme, this.xAxis, this.yAxis) as Record<
      string,
      unknown
    >;
    layout.showlegend = this.showLegend;
    if (this.hovermode) layout.hovermode = this.hovermode;
    const cfg = buildConfig(this.modebar) as Record<string, unknown>;
    if (this.modebarRemove && this.modebar) {
      cfg.modeBarButtonsToRemove = this.modebarRemove;
    }
    await this.plotly.newPlot(
      this.container,
      traces as unknown as Parameters<PlotlyModule["newPlot"]>[1],
      layout as unknown as Parameters<PlotlyModule["newPlot"]>[2],
      cfg as unknown as Parameters<PlotlyModule["newPlot"]>[3],
    );
    if (this.disposed) {
      this.plotly.purge(this.container);
      return;
    }
    this.wireClickEvent();
  }

  private wireClickEvent(): void {
    const div = this.container;
    if (!div.on) return;
    div.on("plotly_click", (raw: unknown) => {
      const e = raw as PlotlyClickEvent;
      const pt = e.points?.[0];
      if (!pt) return;
      const seriesId = this.seriesIds[pt.curveNumber];
      if (!seriesId) return;
      for (const cb of this.clickListeners) {
        cb({ seriesId, index: pt.pointIndex, x: pt.x, y: pt.y });
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
      if (this.disposed || !this.plotly) return;
      const theme = resolveTheme(this.themeMode);
      const layout = buildLayout(theme, this.xAxis, this.yAxis);
      this.plotly.relayout(
        this.container,
        layout as unknown as Parameters<PlotlyModule["relayout"]>[1],
      );
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}
