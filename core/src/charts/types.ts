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
  /** Sliding window in points per series. null = unbounded. */
  windowSize?: number | null;
  /** Modebar visible. Default false to match sidebar density. */
  modebar?: boolean;
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
