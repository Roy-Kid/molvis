import { type PlotlyModule, loadPlotly } from "./plotly_loader";
import { buildConfig, buildLayout, resolveTheme } from "./theme";
import type { AxisConfig, ThemeMode } from "./types";

/**
 * One row on the gantt chart. ``statusGroup`` keys into
 * {@link GanttChartConfig.statusColors} so the chart can colour bars
 * without the caller mutating raw plotly traces.
 */
export interface GanttTask {
  /** Stable identifier — surfaced in click events. */
  id: string;
  /** Y-axis label; tasks with the same label collapse onto one row. */
  label: string;
  start: Date | string | number;
  end: Date | string | number;
  /** Bucket key into {@link GanttChartConfig.statusColors}. */
  statusGroup: string;
  /** Optional inline HTML hover; falls back to a default if omitted. */
  hover?: string;
  /** Free-form payload echoed back in click events. */
  customdata?: unknown;
}

export interface GanttChartConfig {
  tasks: GanttTask[];
  /** Map ``statusGroup`` → CSS colour. Missing keys fall back to ``#a3a3a3``. */
  statusColors: Record<string, string>;
  /** Optional friendly label per status group used in the legend. */
  statusLabels?: Record<string, string>;
  /**
   * Optional per-status opacity (0–1) applied to that group's trace line.
   * Use to fade pending/queued bars so they're distinguishable at a glance
   * from active ones.
   */
  statusOpacity?: Record<string, number>;
  /** Order in which legend groups appear. Unknown keys are appended. */
  statusOrder?: string[];
  /** Bar thickness in pixels. Default 18. */
  barWidth?: number;
  /** Per-row spacing in pixels — drives total height. Default 28. */
  rowHeight?: number;
  /** Show the legend strip beneath the chart. Default true. */
  showLegend?: boolean;
  xAxis?: AxisConfig;
  modebar?: boolean;
  theme?: ThemeMode;
}

export interface GanttClickEvent {
  taskId: string;
  label: string;
  customdata?: unknown;
}

type ClickListener = (e: GanttClickEvent) => void;

interface PlotlyClickPoint {
  curveNumber: number;
  pointIndex: number;
  customdata?: unknown;
}

interface PlotlyClickEvent {
  points?: PlotlyClickPoint[];
}

interface PlotlyDiv extends HTMLElement {
  on?: (event: string, cb: (e: unknown) => void) => void;
  removeAllListeners?: (event: string) => void;
}

const FALLBACK_COLOR = "#a3a3a3";

const toIso = (value: Date | string | number): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return value;
};

/**
 * Gantt chart implemented as one scatter trace per status group, with
 * each task drawn as a thick line segment between (start, end). Pattern
 * lifted from plotly's gantt recipe — keeps the rendering on
 * ``scattergl`` so we get free zoom + the legend toggles status groups.
 */
export class GanttChart {
  private readonly container: PlotlyDiv;
  private config: GanttChartConfig;
  private themeMode: ThemeMode;
  private readonly clickListeners = new Set<ClickListener>();
  private plotly: PlotlyModule | null = null;
  private disposed = false;
  private readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private resizeRaf: number | null = null;
  /**
   * Trace → tasks lookup so click events can recover the originating
   * task without round-tripping IDs through customdata for every point.
   */
  private traceTasks: GanttTask[][] = [];

  constructor(container: HTMLElement, config: GanttChartConfig) {
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

  async update(partial: Partial<GanttChartConfig>): Promise<void> {
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

  onTaskClick(cb: ClickListener): () => void {
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

  private renderInFlight: Promise<void> | null = null;

  private async render(): Promise<void> {
    if (!this.plotly) return;
    // Serialise concurrent renders so a theme-observer fire-and-forget
    // can't interleave with an explicit update() — preserves traceTasks
    // ↔ rendered-traces consistency that the click handler relies on.
    if (this.renderInFlight) await this.renderInFlight;
    const run = this.renderImpl();
    this.renderInFlight = run.finally(() => {
      if (this.renderInFlight === run) this.renderInFlight = null;
    });
    return run;
  }

  private async renderImpl(): Promise<void> {
    if (!this.plotly) return;
    const theme = resolveTheme(this.themeMode);
    const { tasks } = this.config;

    const grouped = new Map<string, GanttTask[]>();
    for (const task of tasks) {
      const list = grouped.get(task.statusGroup) ?? [];
      list.push(task);
      grouped.set(task.statusGroup, list);
    }

    const knownOrder = this.config.statusOrder ?? [];
    const remainingKeys = [...grouped.keys()].filter(
      (k) => !knownOrder.includes(k),
    );
    const orderedKeys = [
      ...knownOrder.filter((k) => grouped.has(k)),
      ...remainingKeys,
    ];

    // Build the next traceTasks locally and swap atomically *after*
    // plotly.react resolves; otherwise a click handler firing mid-
    // render would see traceTasks empty.
    const nextTraceTasks: GanttTask[][] = [];
    const traces = orderedKeys.map((group) => {
      const groupTasks = grouped.get(group) ?? [];
      nextTraceTasks.push(groupTasks);
      const x: Array<string | null> = [];
      const y: Array<string | null> = [];
      const hovertemplate: string[] = [];
      const pointToTask: number[] = [];

      groupTasks.forEach((task, taskIdx) => {
        x.push(toIso(task.start), toIso(task.end), null);
        y.push(task.label, task.label, null);
        const hover = task.hover
          ? `${task.hover}<extra></extra>`
          : `<b>${task.label}</b><br>${toIso(task.start)} → ${toIso(task.end)}<extra></extra>`;
        hovertemplate.push(hover, hover, "");
        pointToTask.push(taskIdx, taskIdx, -1);
      });

      const color = this.config.statusColors[group] ?? FALLBACK_COLOR;
      const trace: Record<string, unknown> = {
        type: "scatter",
        mode: "lines",
        name: this.config.statusLabels?.[group] ?? group,
        x,
        y,
        hovertemplate,
        line: { color, width: this.config.barWidth ?? 18 },
        connectgaps: false,
        meta: pointToTask,
      };
      const opacity = this.config.statusOpacity?.[group];
      if (opacity !== undefined) trace.opacity = opacity;
      return trace;
    });

    const labelOrder = tasks.map((task) => task.label);
    const dedupedLabels = [...new Set(labelOrder)].reverse();
    const layout = buildLayout(theme, this.config.xAxis, undefined) as Record<
      string,
      unknown
    >;
    layout.barmode = undefined;
    layout.showlegend = this.config.showLegend ?? true;
    layout.hovermode = "closest";
    layout.height = Math.max(
      220,
      Math.min(720, (this.config.rowHeight ?? 28) * dedupedLabels.length + 90),
    );
    layout.margin = { l: 240, r: 24, t: 12, b: 40 };
    layout.legend = { orientation: "h", y: -0.18, x: 0 };
    (layout.xaxis as Record<string, unknown>).type = "date";
    layout.yaxis = {
      ...(layout.yaxis as Record<string, unknown>),
      type: "category",
      categoryorder: "array",
      categoryarray: dedupedLabels,
      automargin: true,
    };

    const cfg = buildConfig(this.config.modebar ?? false);
    await this.plotly.react(
      this.container,
      traces as unknown as Parameters<PlotlyModule["react"]>[1],
      layout as unknown as Parameters<PlotlyModule["react"]>[2],
      cfg as unknown as Parameters<PlotlyModule["react"]>[3],
    );
    // Atomic swap after react() resolves — click handler is guaranteed
    // to see traceTasks consistent with the visible traces.
    this.traceTasks = nextTraceTasks;
  }

  private wireClickEvent(): void {
    const div = this.container;
    if (!div.on) return;
    div.on("plotly_click", (raw: unknown) => {
      const e = raw as PlotlyClickEvent;
      const pt = e.points?.[0];
      if (!pt) return;
      const traceTasks = this.traceTasks[pt.curveNumber];
      if (!traceTasks) return;
      // Each task contributes a (start, end, null) triplet — Math.floor
      // generally maps clicks back to the right task, but plotly may
      // emit clicks on the null gap with pointIndex=3k+2. Skip those
      // explicitly rather than mis-attributing to task k.
      if (pt.pointIndex % 3 === 2) return;
      const taskIdx = Math.floor(pt.pointIndex / 3);
      const task = traceTasks[taskIdx];
      if (!task) return;
      for (const cb of this.clickListeners) {
        cb({
          taskId: task.id,
          label: task.label,
          customdata: task.customdata,
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
