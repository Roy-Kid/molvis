export type ThemeMode = "light" | "dark" | "auto";

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface LineSeriesConfig {
  id: string;
  label?: string;
  color?: string;
  initialPoints?: SeriesPoint[];
  /** Per-series hovertemplate override. */
  hovertemplate?: string;
  /** Default ``2`` — width in pixels of the line stroke. */
  width?: number;
  /** ``"lines"`` (default) or ``"lines+markers"``. */
  mode?: "lines" | "lines+markers";
}

export interface AxisConfig {
  label?: string;
  type?: "linear" | "log";
  range?: [number, number];
  /** Plotly d3 format string for tick labels (e.g. "%H:00", ".2s"). */
  tickformat?: string;
  /** Hint for the maximum number of ticks plotly should draw. */
  nticks?: number;
  /** Stay above zero / below zero. Mirrors plotly's ``axis.rangemode``. */
  rangemode?: "normal" | "tozero" | "nonnegative";
  /** Grow the plot area to fit long tick labels. Mirrors ``axis.automargin``. */
  automargin?: boolean;
  /** Per-axis tick font override (size + colour). */
  tickfont?: { size?: number; color?: string };
}

export interface LegendConfig {
  /** ``"h"`` (horizontal, below) or ``"v"`` (vertical, right). Default plotly choice. */
  orientation?: "h" | "v";
  /** Plotly paper-coords y offset (e.g. ``-0.3`` floats legend below the plot). */
  y?: number;
  /** Plotly paper-coords x offset. */
  x?: number;
  font?: { size?: number; color?: string };
}

export interface LineChartConfig {
  series: LineSeriesConfig[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  /** Sliding window in points per series. null = unbounded. */
  windowSize?: number | null;
  /** Modebar visible. Default false to match sidebar density. */
  modebar?: boolean;
  /** Plotly modebar buttons to hide when ``modebar`` is enabled. */
  modebarRemove?: string[];
  /**
   * Default hovertemplate applied to every series that does not set its
   * own. Standard plotly tokens (``%{y:.6g}``) are supported.
   */
  hovertemplate?: string;
  /** ``hovermode``; ``"x unified"`` overlays values across series at the same x. */
  hovermode?: "closest" | "x" | "x unified";
  /** Show legend strip. Default false. */
  showLegend?: boolean;
  /** Light/dark; "auto" tracks <html class="dark">. */
  theme?: ThemeMode;
}

export interface LineChartClickEvent {
  seriesId: string;
  index: number;
  x: number;
  y: number;
}

export interface ScatterPoint {
  x: number;
  y: number;
  customdata?: unknown;
}

export interface ScatterMarkerConfig {
  size?: number;
  /** Single color string, per-point color array, or numeric column. */
  color?: string | string[] | number[];
  colorscale?: string;
  showscale?: boolean;
}

export interface ScatterChartConfig {
  points: ScatterPoint[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  marker?: ScatterMarkerConfig;
  /** Optional ring overlay for a single point. */
  highlight?: { index: number };
  modebar?: boolean;
  theme?: ThemeMode;
  /** Plotly hovertemplate. Default: "%{x:.3f}, %{y:.3f}<extra></extra>". */
  hovertemplate?: string;
}

export interface ScatterClickEvent {
  index: number;
  x: number;
  y: number;
  customdata?: unknown;
}
