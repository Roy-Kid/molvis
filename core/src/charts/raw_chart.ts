import { loadPlotly, type PlotlyModule } from "./plotly_loader";

/**
 * Untyped passthrough to plotly's ``react`` — meant for callers that
 * receive arbitrary plot specs (e.g. an LLM agent emitting raw plotly
 * JSON). The typed {@link LineChart} / {@link BarChart} / etc. stay
 * the preferred APIs; ``RawChart`` exists so projects can finish
 * dropping their own ``react-plotly.js`` dependency without losing
 * the "render whatever the upstream emitted" escape hatch.
 *
 * Shares the same lazily-loaded plotly bundle as the other charts —
 * no second copy lands in the consumer's tree.
 */
export interface RawChartConfig {
  data: unknown[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

interface PlotlyDiv extends HTMLElement {
  removeAllListeners?: (ev: string) => void;
}

export class RawChart {
  private readonly container: PlotlyDiv;
  private spec: RawChartConfig;
  private plotly: PlotlyModule | null = null;
  private disposed = false;
  private readonly mountPromise: Promise<void>;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRaf: number | null = null;

  constructor(container: HTMLElement, spec: RawChartConfig) {
    this.container = container as PlotlyDiv;
    this.spec = spec;
    this.mountPromise = this.mount();
    this.setupResizeObserver();
  }

  ready(): Promise<void> {
    return this.mountPromise;
  }

  async update(spec: RawChartConfig): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    this.spec = spec;
    await this.render();
  }

  async resize(): Promise<void> {
    await this.mountPromise;
    if (this.disposed || !this.plotly) return;
    this.plotly.Plots.resize(this.container);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.plotly?.purge(this.container);
  }

  private async mount(): Promise<void> {
    this.plotly = await loadPlotly();
    if (this.disposed) return;
    await this.render();
  }

  private async render(): Promise<void> {
    if (!this.plotly) return;
    await this.plotly.react(
      this.container,
      this.spec.data as Parameters<PlotlyModule["react"]>[1],
      (this.spec.layout ?? {}) as Parameters<PlotlyModule["react"]>[2],
      (this.spec.config ?? { responsive: true }) as Parameters<
        PlotlyModule["react"]
      >[3],
    );
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
}
