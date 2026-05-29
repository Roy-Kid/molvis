import type { AxisConfig, ThemeMode } from "./types";

/** 20-entry categorical palette. Migrated verbatim from PCATool. */
export const CHART_PALETTE: readonly string[] = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#aec7e8",
  "#ffbb78",
  "#98df8a",
  "#ff9896",
  "#c5b0d5",
  "#c49c94",
  "#f7b6d2",
  "#c7c7c7",
  "#dbdb8d",
  "#9edae5",
];

export const CHART_DEFAULT_COLOR = "#60a5fa";

export interface ChartTheme {
  background: "transparent";
  font: { size: number; color: string };
  axis: { gridColor: string; tickColor: string };
  palette: readonly string[];
}

const LIGHT_THEME: ChartTheme = {
  background: "transparent",
  font: { size: 10, color: "#52525b" },
  axis: { gridColor: "rgba(120,120,120,0.18)", tickColor: "#a1a1aa" },
  palette: CHART_PALETTE,
};

const DARK_THEME: ChartTheme = {
  background: "transparent",
  font: { size: 10, color: "#d4d4d8" },
  axis: { gridColor: "rgba(220,220,220,0.12)", tickColor: "#71717a" },
  palette: CHART_PALETTE,
};

/**
 * Resolve a theme mode to a concrete ChartTheme. `auto` observes
 * `<html class="dark">` once at call time — for live tracking, the
 * chart classes set up a MutationObserver and call this on change.
 */
export function resolveTheme(mode: ThemeMode): ChartTheme {
  if (mode === "dark") return DARK_THEME;
  if (mode === "light") return LIGHT_THEME;
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return DARK_THEME;
  }
  return LIGHT_THEME;
}

/** Default plotly layout partial matching sidebar density. */
export function buildLayout(
  theme: ChartTheme,
  xAxis?: AxisConfig,
  yAxis?: AxisConfig,
): Record<string, unknown> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { size: theme.font.size, color: theme.font.color },
    margin: { l: 40, r: 10, t: 10, b: 40 },
    showlegend: false,
    hovermode: "closest",
    dragmode: "pan",
    xaxis: buildAxis(theme, xAxis),
    yaxis: buildAxis(theme, yAxis),
  };
}

function buildAxis(
  theme: ChartTheme,
  cfg: AxisConfig | undefined,
): Record<string, unknown> {
  const axis: Record<string, unknown> = {
    gridcolor: theme.axis.gridColor,
    tickcolor: theme.axis.tickColor,
    tickfont: { size: theme.font.size, color: theme.font.color },
    zerolinecolor: theme.axis.gridColor,
  };
  if (cfg?.label) axis.title = { text: cfg.label };
  if (cfg?.type) axis.type = cfg.type;
  if (cfg?.range) axis.range = cfg.range;
  if (cfg?.tickformat) axis.tickformat = cfg.tickformat;
  if (cfg?.nticks !== undefined) axis.nticks = cfg.nticks;
  if (cfg?.rangemode) axis.rangemode = cfg.rangemode;
  if (cfg?.automargin !== undefined) axis.automargin = cfg.automargin;
  if (cfg?.tickfont) {
    axis.tickfont = {
      size: cfg.tickfont.size ?? theme.font.size,
      color: cfg.tickfont.color ?? theme.font.color,
    };
  }
  return axis;
}

/** Default plotly config partial. */
export function buildConfig(modebar: boolean): Record<string, unknown> {
  return {
    displayModeBar: modebar,
    scrollZoom: true,
    responsive: true,
  };
}
