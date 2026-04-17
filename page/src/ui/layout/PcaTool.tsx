import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import {
  type DatasetExploration,
  type ExplorationConfig,
  type Molvis,
  runExploration,
} from "@molvis/core";
import { AlertCircle, Info, Play } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PcaToolProps {
  app: Molvis | null;
}

// ---------------------------------------------------------------------------
// Plotly lazy loader
// ---------------------------------------------------------------------------

type PlotlyModule = typeof import("plotly.js-dist-min");
let _plotlyModule: PlotlyModule | null = null;
async function loadPlotly(): Promise<PlotlyModule> {
  if (!_plotlyModule) {
    _plotlyModule = await import("plotly.js-dist-min");
  }
  return _plotlyModule;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_K = 3;
const K_MIN = 2;
const K_MAX = 20;
const DEFAULT_SEED = 42;

/** 20-entry qualitative palette for cluster and categorical coloring. */
const CATEGORICAL_PALETTE: readonly string[] = [
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

const SOLID_COLOR = "#60a5fa";

type ClusteringMethod = "none" | "kmeans";

/** Describe a `colorBy` choice for the UI select. */
interface ColorByOption {
  value: string;
  label: string;
  disabled?: boolean;
  config: ExplorationConfig["colorBy"];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Build the per-point color value passed to Plotly. Uses a discrete palette
 * for categorical (`cluster`) coloring and a continuous colorscale for
 * numeric (`label`, `frame-index`) coloring.
 */
function buildMarker(
  colorBy: ExplorationConfig["colorBy"],
  exploration: DatasetExploration,
  frameLabels: Map<string, Float64Array> | null,
): { color: unknown; colorscale?: unknown; showscale?: boolean } {
  const { nFrames } = exploration.descriptors;

  if (colorBy.kind === "cluster") {
    const clusters = exploration.clusters;
    if (!clusters) {
      return { color: SOLID_COLOR };
    }
    const colors = new Array<string>(nFrames);
    for (let i = 0; i < nFrames; i++) {
      const cid = clusters[i];
      const safe = cid >= 0 ? cid % CATEGORICAL_PALETTE.length : 0;
      colors[i] = CATEGORICAL_PALETTE[safe];
    }
    return { color: colors };
  }

  if (colorBy.kind === "label") {
    const column = frameLabels?.get(colorBy.name);
    if (!column) return { color: SOLID_COLOR };
    return {
      color: Array.from(column),
      colorscale: "Viridis",
      showscale: true,
    };
  }

  if (colorBy.kind === "frame-index") {
    const arr = new Array<number>(nFrames);
    for (let i = 0; i < nFrames; i++) arr[i] = i;
    return {
      color: arr,
      colorscale: "Viridis",
      showscale: true,
    };
  }

  return { color: SOLID_COLOR };
}

/** Sorted descriptor key list for stable rendering. */
function sortedKeys(frameLabels: Map<string, Float64Array> | null): string[] {
  if (!frameLabels) return [];
  return Array.from(frameLabels.keys()).sort();
}

// ---------------------------------------------------------------------------
// PcaTool
// ---------------------------------------------------------------------------

export function PcaTool({ app }: PcaToolProps): React.ReactElement | null {
  const [frameLabels, setFrameLabels] = useState<Map<
    string,
    Float64Array
  > | null>(() => app?.system.frameLabels ?? null);
  const [exploration, setExploration] = useState<DatasetExploration | null>(
    () => app?.system.exploration ?? null,
  );
  const [tickedDescriptors, setTickedDescriptors] = useState<Set<string>>(
    () => new Set(frameLabels ? frameLabels.keys() : []),
  );
  const [clusteringMethod, setClusteringMethod] =
    useState<ClusteringMethod>("none");
  const [kText, setKText] = useState<string>(String(DEFAULT_K));
  const [colorBy, setColorBy] = useState<ExplorationConfig["colorBy"]>({
    kind: "frame-index",
  });
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(
    () => app?.system.trajectory.length ?? 0,
  );

  // Keep track of colorBy in a ref so the plot effect can read the latest
  // value without becoming a dependency (we manually include it below).
  const plotRef = useRef<HTMLDivElement | null>(null);

  // --- Subscribe to system events ------------------------------------------

  useEffect(() => {
    if (!app) return;

    // Seed from current state (handles late-mount).
    setFrameLabels(app.system.frameLabels);
    setExploration(app.system.exploration);
    setTrajectoryLength(app.system.trajectory.length);

    const unsubLabels = app.events.on("frame-labels-change", (next) => {
      setFrameLabels(next);
    });
    const unsubExpl = app.events.on("exploration-change", (next) => {
      setExploration(next);
    });
    const unsubTraj = app.events.on("trajectory-change", (traj) => {
      setTrajectoryLength(traj.length);
    });

    return () => {
      unsubLabels();
      unsubExpl();
      unsubTraj();
    };
  }, [app]);

  // Auto-populate ticked descriptors whenever frameLabels changes.
  useEffect(() => {
    setTickedDescriptors(new Set(frameLabels ? frameLabels.keys() : []));
  }, [frameLabels]);

  // Clear error when the user changes compute-affecting inputs.
  useEffect(() => {
    setComputeError(null);
  }, []);

  // --- Compute -------------------------------------------------------------

  const parsedK = useMemo(() => {
    const n = Number.parseInt(kText, 10);
    if (!Number.isFinite(n)) return DEFAULT_K;
    return clamp(n, K_MIN, K_MAX);
  }, [kText]);

  const descriptorKeys = useMemo(() => sortedKeys(frameLabels), [frameLabels]);

  const computeDisabled =
    computing ||
    !frameLabels ||
    tickedDescriptors.size < 2 ||
    trajectoryLength < 3;

  const buildConfig = useCallback((): ExplorationConfig => {
    const names = descriptorKeys.filter((name) => tickedDescriptors.has(name));
    const clustering: ExplorationConfig["clustering"] =
      clusteringMethod === "kmeans"
        ? { method: "kmeans", k: parsedK, seed: DEFAULT_SEED }
        : { method: "none" };
    const effectiveColorBy: ExplorationConfig["colorBy"] =
      colorBy.kind === "cluster" && clustering.method === "none"
        ? { kind: "frame-index" }
        : colorBy;
    return {
      descriptorNames: names,
      reduction: { method: "pca" },
      clustering,
      colorBy: effectiveColorBy,
    };
  }, [descriptorKeys, tickedDescriptors, clusteringMethod, parsedK, colorBy]);

  const handleCompute = useCallback(async () => {
    if (!app || !frameLabels) return;
    setComputing(true);
    setComputeError(null);
    try {
      const cfg = buildConfig();
      const result = await runExploration(frameLabels, cfg);
      app.system.setExploration(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "PCA computation failed";
      setComputeError(message);
    } finally {
      setComputing(false);
    }
  }, [app, frameLabels, buildConfig]);

  // --- Descriptor toggle ---------------------------------------------------

  const toggleDescriptor = useCallback((name: string, checked: boolean) => {
    setTickedDescriptors((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  // --- Color-by options (derived) -----------------------------------------

  const colorByOptions: ColorByOption[] = useMemo(() => {
    const opts: ColorByOption[] = [];
    opts.push({
      value: "frame-index",
      label: "Frame index",
      config: { kind: "frame-index" },
    });
    opts.push({
      value: "cluster",
      label: "Cluster",
      disabled: clusteringMethod === "none",
      config: { kind: "cluster" },
    });
    for (const name of descriptorKeys) {
      opts.push({
        value: `label:${name}`,
        label: `Descriptor: ${name}`,
        config: { kind: "label", name },
      });
    }
    opts.push({
      value: "solid",
      label: "Solid",
      config: { kind: "solid" },
    });
    return opts;
  }, [descriptorKeys, clusteringMethod]);

  const currentColorByValue = useMemo(() => {
    if (colorBy.kind === "cluster") return "cluster";
    if (colorBy.kind === "frame-index") return "frame-index";
    if (colorBy.kind === "solid") return "solid";
    return `label:${colorBy.name}`;
  }, [colorBy]);

  const handleColorByChange = useCallback(
    (value: string) => {
      const opt = colorByOptions.find((o) => o.value === value);
      if (opt) setColorBy(opt.config);
    },
    [colorByOptions],
  );

  // --- Plotly: render + click bind -----------------------------------------

  useEffect(() => {
    const div = plotRef.current;
    if (!div || !exploration) return;
    let cancelled = false;

    (async () => {
      const Plotly = await loadPlotly();
      if (cancelled || !plotRef.current) return;

      const { coords, axes } = exploration.embedding;
      const nFrames = exploration.descriptors.nFrames;
      const xs = new Array<number>(nFrames);
      const ys = new Array<number>(nFrames);
      for (let i = 0; i < nFrames; i++) {
        xs[i] = coords[2 * i];
        ys[i] = coords[2 * i + 1];
      }
      const customdata = Array.from({ length: nFrames }, (_, i) => i);

      const marker = buildMarker(colorBy, exploration, frameLabels);

      const currentIdx = app?.system.trajectory.currentIndex ?? 0;
      const curX = coords[2 * currentIdx] ?? 0;
      const curY = coords[2 * currentIdx + 1] ?? 0;

      const traces: unknown[] = [
        {
          type: "scattergl",
          mode: "markers",
          x: xs,
          y: ys,
          customdata,
          marker: { size: 6, ...marker },
          hovertemplate:
            "frame #%{customdata}<br>%{x:.3f}, %{y:.3f}<extra></extra>",
          name: "frames",
        },
        {
          type: "scattergl",
          mode: "markers",
          x: [curX],
          y: [curY],
          marker: {
            size: 14,
            line: { width: 2, color: "white" },
            color: "rgba(0,0,0,0)",
          },
          hoverinfo: "skip",
          showlegend: false,
          name: "current",
        },
      ];

      const layout: unknown = {
        xaxis: { title: { text: axes[0] } },
        yaxis: { title: { text: axes[1] } },
        margin: { l: 40, r: 10, t: 10, b: 40 },
        showlegend: false,
        hovermode: "closest",
        dragmode: "pan",
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "rgba(0,0,0,0)",
        font: { size: 10 },
      };

      const cfg: unknown = {
        displayModeBar: false,
        scrollZoom: true,
        responsive: true,
      };

      await (
        Plotly as unknown as {
          react: (
            div: HTMLElement,
            traces: unknown,
            layout: unknown,
            cfg: unknown,
          ) => Promise<unknown>;
        }
      ).react(div, traces, layout, cfg);

      if (cancelled) return;

      const clickHandler = (ev: unknown) => {
        const e = ev as { points?: Array<{ customdata?: unknown }> };
        const pt = e.points?.[0];
        if (pt && typeof pt.customdata === "number") {
          app?.seekFrame(pt.customdata);
        }
      };

      const divWithEvents = div as unknown as {
        on: (ev: string, cb: (e: unknown) => void) => void;
        removeAllListeners?: (ev: string) => void;
      };
      divWithEvents.removeAllListeners?.("plotly_click");
      divWithEvents.on("plotly_click", clickHandler);
    })();

    return () => {
      cancelled = true;
    };
  }, [app, exploration, colorBy, frameLabels]);

  // --- Plotly: frame-change restyle ---------------------------------------

  useEffect(() => {
    if (!app || !exploration) return;
    let rafId: number | null = null;
    let pending: number | null = null;

    const run = () => {
      rafId = null;
      const i = pending;
      pending = null;
      const div = plotRef.current;
      if (i === null || !div) return;
      const { coords } = exploration.embedding;
      if (i < 0 || i >= exploration.descriptors.nFrames) return;
      loadPlotly().then((Plotly) => {
        const currentDiv = plotRef.current;
        if (!currentDiv) return;
        (
          Plotly as unknown as {
            restyle: (
              div: HTMLElement,
              update: unknown,
              traces: number[],
            ) => Promise<unknown>;
          }
        ).restyle(
          currentDiv,
          {
            x: [[coords[2 * i]]],
            y: [[coords[2 * i + 1]]],
          },
          [1],
        );
      });
    };

    const unsub = app.events.on("frame-change", (i) => {
      pending = i;
      if (rafId === null) rafId = requestAnimationFrame(run);
    });

    return () => {
      unsub();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [app, exploration]);

  // --- Cleanup Plotly instance on unmount ---------------------------------

  useEffect(() => {
    return () => {
      const div = plotRef.current;
      if (!div) return;
      loadPlotly()
        .then((Plotly) => {
          (Plotly as unknown as { purge: (div: HTMLElement) => void }).purge(
            div,
          );
        })
        .catch(() => {
          // swallow: component is already unmounting
        });
    };
  }, []);

  // --- Render --------------------------------------------------------------

  const hasLabels = frameLabels !== null && frameLabels.size > 0;

  if (!hasLabels) {
    return (
      <div className="px-2 py-2">
        <p className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight">
          <Info className="h-3 w-3 shrink-0 mt-px" />
          <span>
            This dataset has no frame labels. Load an ExtXYZ trajectory with{" "}
            <code className="font-mono">key=value</code> properties in comment
            lines.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SidebarSection
        title="Descriptors"
        subtitle={`${tickedDescriptors.size} / ${descriptorKeys.length} selected`}
        defaultOpen={true}
      >
        <div className="space-y-0.5">
          {descriptorKeys.map((name) => {
            const id = `pca-desc-${name}`;
            const checked = tickedDescriptors.has(name);
            const column = frameLabels?.get(name);
            const nFinite = column ? countFinite(column) : 0;
            const total = column?.length ?? 0;
            return (
              <div
                key={name}
                className="flex items-center gap-1.5 px-0.5 py-0.5"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(v) => toggleDescriptor(name, v === true)}
                  className="h-3.5 w-3.5"
                />
                <Label
                  htmlFor={id}
                  className="text-xs font-mono cursor-pointer leading-none flex-1 min-w-0 truncate"
                  title={`${name} — ${nFinite}/${total} finite`}
                >
                  {name}
                </Label>
                <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                  {nFinite}/{total}
                </span>
              </div>
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection title="Clustering" defaultOpen={true}>
        <div className="flex items-center gap-1.5">
          <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
            Method
          </span>
          <Select
            value={clusteringMethod}
            onValueChange={(v) => setClusteringMethod(v as ClusteringMethod)}
          >
            <SelectTrigger
              className="h-7 flex-1 min-w-0 px-2 text-xs"
              aria-label="Clustering method"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-xs">None</span>
              </SelectItem>
              <SelectItem value="kmeans">
                <span className="text-xs">k-means</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {clusteringMethod === "kmeans" && (
          <div className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
              k
            </span>
            <Input
              className="h-7 flex-1 min-w-0 text-xs font-mono"
              value={kText}
              onChange={(e) => setKText(e.target.value)}
              inputMode="numeric"
              placeholder={String(DEFAULT_K)}
              aria-label="Number of clusters"
            />
            <span className="text-[9px] text-muted-foreground shrink-0">
              {K_MIN}-{K_MAX}
            </span>
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Color" defaultOpen={true}>
        <div className="flex items-center gap-1.5">
          <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
            Color by
          </span>
          <Select
            value={currentColorByValue}
            onValueChange={handleColorByChange}
          >
            <SelectTrigger
              className="h-7 flex-1 min-w-0 px-2 text-xs"
              aria-label="Color by"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {colorByOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  <span className="text-xs">{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarSection>

      <SidebarSection title="Compute" defaultOpen={true}>
        <Button
          size="sm"
          className="h-7 w-full text-xs gap-1.5"
          onClick={handleCompute}
          disabled={computeDisabled}
        >
          <Play className="h-3.5 w-3.5" />
          {computing
            ? "Computing…"
            : trajectoryLength < 3
              ? "Needs ≥ 3 frames"
              : tickedDescriptors.size < 2
                ? "Pick ≥ 2 descriptors"
                : "Compute"}
        </Button>

        {computeError && (
          <p className="flex items-start gap-1 text-[10px] text-destructive leading-tight px-0.5">
            <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
            <span className="truncate" title={computeError}>
              {computeError}
            </span>
          </p>
        )}

        {exploration && !computeError && (
          <p className="text-[9px] text-muted-foreground px-0.5 truncate">
            {exploration.embedding.axes[0]} · {exploration.embedding.axes[1]}
          </p>
        )}
      </SidebarSection>

      <SidebarSection
        title="Map"
        defaultOpen={true}
        className="flex-1 min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        {exploration ? (
          <div ref={plotRef} className="flex-1 min-h-0" />
        ) : (
          <p className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight px-0.5">
            <Info className="h-3 w-3 shrink-0 mt-px" />
            <span>Click Compute to render the 2D map</span>
          </p>
        )}
      </SidebarSection>
    </div>
  );
}

/** Count finite values in a column (used for the "n_finite/total" hint). */
function countFinite(column: Float64Array): number {
  let n = 0;
  for (let i = 0; i < column.length; i++) {
    if (Number.isFinite(column[i])) n++;
  }
  return n;
}
