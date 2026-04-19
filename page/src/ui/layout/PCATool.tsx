import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import {
  type Molvis,
  type Trajectory,
  WasmKMeans,
  WasmPca2,
} from "@molvis/core";
import { AlertCircle, Info, Play } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PCAToolProps {
  app: Molvis | null;
}

type PlotlyModule = typeof import("plotly.js-dist-min");
let _plotlyModule: PlotlyModule | null = null;
async function loadPlotly(): Promise<PlotlyModule> {
  if (!_plotlyModule) {
    _plotlyModule = await import("plotly.js-dist-min");
  }
  return _plotlyModule;
}

const DEFAULT_K = 3;
const K_MIN = 2;
const K_MAX = 20;
const DEFAULT_SEED = 42;
const KMEANS_MAX_ITER = 100;

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

type ColorBy =
  | { kind: "cluster" }
  | { kind: "label"; name: string }
  | { kind: "frame-index" }
  | { kind: "solid" };

interface PcaResult {
  coords: Float64Array;
  variance: [number, number];
  clusters: Int32Array | null;
}

interface DescriptorInfo {
  /** Descriptor name (a key found via `frame.metaNames()` across the trajectory). */
  name: string;
  /** Number of frames where the key parses to a finite number. */
  finite: number;
  /** Total frame count. */
  total: number;
}

interface ColorByOption {
  value: string;
  label: string;
  disabled?: boolean;
  config: ColorBy;
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function formatAxis(v: number, total: number, i: number): string {
  const label = `PC${i + 1}`;
  if (!Number.isFinite(total) || total <= 0) return label;
  return `${label} (${((v / total) * 100).toFixed(1)}%)`;
}

/**
 * Walk the trajectory once and bucket every numeric meta key's finite count.
 * Keys that never produced a finite number are dropped (they are purely
 * categorical). This is the only consumer of `frame.getMetaScalar` in the
 * UI — there is no aggregated cache anywhere in core.
 */
function scanDescriptors(trajectory: Trajectory): DescriptorInfo[] {
  const nFrames = trajectory.length;
  if (nFrames === 0) return [];

  const finite = new Map<string, number>();
  for (let i = 0; i < nFrames; i++) {
    const frame = trajectory.get(i);
    if (!frame) continue;
    for (const name of frame.metaNames()) {
      const v = frame.getMetaScalar(name);
      if (v === undefined || !Number.isFinite(v)) {
        if (!finite.has(name)) finite.set(name, 0);
        continue;
      }
      finite.set(name, (finite.get(name) ?? 0) + 1);
    }
  }

  const out: DescriptorInfo[] = [];
  for (const [name, count] of finite) {
    if (count > 0) out.push({ name, finite: count, total: nFrames });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Build a per-frame column for `name` on demand (NaN where missing). */
function buildLabelColumn(trajectory: Trajectory, name: string): Float64Array {
  const col = new Float64Array(trajectory.length).fill(Number.NaN);
  for (let i = 0; i < trajectory.length; i++) {
    const v = trajectory.get(i)?.getMetaScalar(name);
    if (v !== undefined && Number.isFinite(v)) col[i] = v;
  }
  return col;
}

function buildMarker(
  colorBy: ColorBy,
  result: PcaResult,
  trajectory: Trajectory,
): { color: unknown; colorscale?: unknown; showscale?: boolean } {
  const nFrames = result.coords.length / 2;

  if (colorBy.kind === "cluster") {
    const clusters = result.clusters;
    if (!clusters) return { color: SOLID_COLOR };
    const colors = new Array<string>(nFrames);
    for (let i = 0; i < nFrames; i++) {
      const cid = clusters[i];
      const safe = cid >= 0 ? cid % CATEGORICAL_PALETTE.length : 0;
      colors[i] = CATEGORICAL_PALETTE[safe];
    }
    return { color: colors };
  }

  if (colorBy.kind === "label") {
    const column = buildLabelColumn(trajectory, colorBy.name);
    return {
      color: Array.from(column),
      colorscale: "Viridis",
      showscale: true,
    };
  }

  if (colorBy.kind === "frame-index") {
    const arr = new Array<number>(nFrames);
    for (let i = 0; i < nFrames; i++) arr[i] = i;
    return { color: arr, colorscale: "Viridis", showscale: true };
  }

  return { color: SOLID_COLOR };
}

export function PCATool({ app }: PCAToolProps): React.ReactElement | null {
  // We key the descriptor scan to `trajectoryRevision`: bumping it forces
  // a re-walk of the (current) Trajectory. This is the only UI-side cache
  // of frame meta; it lives for the component's lifetime, not on System.
  const [trajectoryRevision, setTrajectoryRevision] = useState(0);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(
    () => app?.system.trajectory.length ?? 0,
  );
  const [pcaResult, setPcaResult] = useState<PcaResult | null>(null);
  const [tickedDescriptors, setTickedDescriptors] = useState<Set<string>>(
    new Set(),
  );
  const [clusteringMethod, setClusteringMethod] =
    useState<ClusteringMethod>("none");
  const [kText, setKText] = useState<string>(String(DEFAULT_K));
  const [colorBy, setColorBy] = useState<ColorBy>({ kind: "frame-index" });
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);

  const [plotDiv, setPlotDiv] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!app) return;
    setTrajectoryLength(app.system.trajectory.length);
    setTrajectoryRevision((r) => r + 1);

    const unsubTraj = app.events.on("trajectory-change", (traj) => {
      setTrajectoryLength(traj.length);
      setTrajectoryRevision((r) => r + 1);
      // Previous embedding was keyed to the old trajectory — dump it.
      setPcaResult(null);
    });

    return () => {
      unsubTraj();
    };
  }, [app]);

  // Walk the trajectory once per revision to enumerate descriptors + finite
  // counts. All three are pure derivations of current frame meta.
  const descriptors = useMemo<DescriptorInfo[]>(() => {
    if (!app) return [];
    // Read trajectoryRevision just to declare the dep — the actual source
    // is app.system.trajectory.
    void trajectoryRevision;
    return scanDescriptors(app.system.trajectory);
  }, [app, trajectoryRevision]);

  const descriptorNames = useMemo(
    () => descriptors.map((d) => d.name),
    [descriptors],
  );

  // Auto-pick everything on new trajectories.
  useEffect(() => {
    setTickedDescriptors(new Set(descriptorNames));
  }, [descriptorNames]);

  const parsedK = useMemo(() => {
    const n = Number.parseInt(kText, 10);
    if (!Number.isFinite(n)) return DEFAULT_K;
    return clamp(n, K_MIN, K_MAX);
  }, [kText]);

  const computeDisabled =
    computing ||
    descriptors.length === 0 ||
    tickedDescriptors.size < 2 ||
    trajectoryLength < 3;

  const handleCompute = useCallback(() => {
    if (!app) return;
    setComputing(true);
    setComputeError(null);
    try {
      const trajectory = app.system.trajectory;
      const names = descriptorNames.filter((n) => tickedDescriptors.has(n));
      const nFrames = trajectory.length;
      const nDescriptors = names.length;

      // Walk the trajectory once, inline, to build the row-major matrix.
      // Frames that are missing a value for a selected descriptor will
      // leave NaN — molrs's PCA rejects non-finite input with a clear error.
      const matrix = new Float64Array(nFrames * nDescriptors);
      matrix.fill(Number.NaN);
      for (let i = 0; i < nFrames; i++) {
        const frame = trajectory.get(i);
        if (!frame) continue;
        for (let j = 0; j < nDescriptors; j++) {
          const v = frame.getMetaScalar(names[j]);
          if (v !== undefined && Number.isFinite(v)) {
            matrix[i * nDescriptors + j] = v;
          }
        }
      }

      let coords: Float64Array;
      let variance: [number, number];
      const pca = new WasmPca2();
      try {
        const result = pca.fitTransform(matrix, nFrames, nDescriptors);
        try {
          coords = result.coords();
          const v = result.variance();
          variance = [v[0], v[1]];
        } finally {
          result.free();
        }
      } finally {
        pca.free();
      }

      let clusters: Int32Array | null = null;
      if (clusteringMethod === "kmeans") {
        const km = new WasmKMeans(parsedK, KMEANS_MAX_ITER, DEFAULT_SEED);
        try {
          clusters = km.fit(coords, nFrames, 2);
        } finally {
          km.free();
        }
      }

      if (colorBy.kind === "cluster" && !clusters) {
        setColorBy({ kind: "frame-index" });
      }

      setPcaResult({ coords, variance, clusters });
    } catch (err) {
      setComputeError(
        err instanceof Error ? err.message : "PCA computation failed",
      );
    } finally {
      setComputing(false);
    }
  }, [
    app,
    descriptorNames,
    tickedDescriptors,
    clusteringMethod,
    parsedK,
    colorBy.kind,
  ]);

  const toggleDescriptor = useCallback((name: string, checked: boolean) => {
    setTickedDescriptors((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  const selectAllState: boolean | "indeterminate" = useMemo(() => {
    if (descriptorNames.length === 0) return false;
    if (tickedDescriptors.size === 0) return false;
    if (tickedDescriptors.size === descriptorNames.length) return true;
    return "indeterminate";
  }, [descriptorNames.length, tickedDescriptors.size]);

  const toggleSelectAll = useCallback(() => {
    setTickedDescriptors((prev) => {
      if (prev.size === descriptorNames.length) return new Set();
      return new Set(descriptorNames);
    });
  }, [descriptorNames]);

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
    for (const name of descriptorNames) {
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
  }, [descriptorNames, clusteringMethod]);

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

  const axes = useMemo((): [string, string] => {
    if (!pcaResult) return ["PC1", "PC2"];
    const [v0, v1] = pcaResult.variance;
    const total = v0 + v1;
    return [formatAxis(v0, total, 0), formatAxis(v1, total, 1)];
  }, [pcaResult]);

  useEffect(() => {
    const div = plotDiv;
    if (!div || !pcaResult || !app) return;
    let cancelled = false;

    (async () => {
      const Plotly = await loadPlotly();
      if (cancelled) return;

      const { coords } = pcaResult;
      const nFrames = coords.length / 2;
      const xs = new Array<number>(nFrames);
      const ys = new Array<number>(nFrames);
      for (let i = 0; i < nFrames; i++) {
        xs[i] = coords[2 * i];
        ys[i] = coords[2 * i + 1];
      }
      const customdata = Array.from({ length: nFrames }, (_, i) => i);

      const marker = buildMarker(colorBy, pcaResult, app.system.trajectory);

      const currentIdx = app.system.trajectory.currentIndex ?? 0;
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
          app.seekFrame(pt.customdata);
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
      const divToClean = div as unknown as {
        removeAllListeners?: (ev: string) => void;
      };
      divToClean.removeAllListeners?.("plotly_click");
      loadPlotly()
        .then((Plotly) => {
          (Plotly as unknown as { purge: (div: HTMLElement) => void }).purge(
            div,
          );
        })
        .catch(() => {});
    };
  }, [app, plotDiv, pcaResult, colorBy, axes]);

  useEffect(() => {
    if (!app || !pcaResult) return;
    let rafId: number | null = null;
    let pending: number | null = null;
    let cancelled = false;

    const run = () => {
      rafId = null;
      const i = pending;
      pending = null;
      if (cancelled) return;
      if (i === null || !plotDiv) return;
      const { coords } = pcaResult;
      const nFrames = coords.length / 2;
      if (i < 0 || i >= nFrames) return;
      loadPlotly().then((Plotly) => {
        if (cancelled || !plotDiv) return;
        (
          Plotly as unknown as {
            restyle: (
              div: HTMLElement,
              update: unknown,
              traces: number[],
            ) => Promise<unknown>;
          }
        ).restyle(
          plotDiv,
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
      cancelled = true;
      unsub();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [app, plotDiv, pcaResult]);

  useEffect(() => {
    if (!plotDiv || !pcaResult) return;
    let rafId: number | null = null;
    let disposed = false;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (disposed) return;
        loadPlotly()
          .then((Plotly) => {
            if (disposed) return;
            (
              Plotly as unknown as {
                Plots: { resize: (el: HTMLElement) => void };
              }
            ).Plots.resize(plotDiv);
          })
          .catch(() => {});
      });
    });
    observer.observe(plotDiv);
    return () => {
      disposed = true;
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [plotDiv, pcaResult]);

  const hasDescriptors = descriptors.length > 0;

  if (!hasDescriptors) {
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
        subtitle={`${tickedDescriptors.size} / ${descriptors.length} selected`}
        defaultOpen={true}
      >
        <div className="rounded-md border overflow-hidden">
          <div className="max-h-[220px] overflow-y-auto">
            <table className="w-full text-xs table-fixed border-collapse">
              <colgroup>
                <col className="w-7" />
                <col />
                <col className="w-14" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur border-b">
                <tr>
                  <th className="p-1 align-middle">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectAllState}
                        onCheckedChange={toggleSelectAll}
                        className="h-3.5 w-3.5"
                        aria-label="Toggle all descriptors"
                      />
                    </div>
                  </th>
                  <th className="text-left px-1.5 py-1 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Name
                  </th>
                  <th className="text-right px-1.5 py-1 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Finite
                  </th>
                </tr>
              </thead>
              <tbody>
                {descriptors.map((d) => {
                  const checked = tickedDescriptors.has(d.name);
                  return (
                    <tr
                      key={d.name}
                      tabIndex={0}
                      className={cn(
                        "border-b last:border-b-0 cursor-pointer transition-colors outline-none focus-visible:bg-muted/40",
                        checked
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/30",
                      )}
                      onClick={() => toggleDescriptor(d.name, !checked)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDescriptor(d.name, !checked);
                        }
                      }}
                    >
                      <td className="p-1 align-middle">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={checked}
                            className="h-3.5 w-3.5 pointer-events-none"
                            tabIndex={-1}
                          />
                        </div>
                      </td>
                      <td
                        className="px-1.5 py-1 font-mono truncate"
                        title={`${d.name} — ${d.finite}/${d.total} finite`}
                      >
                        {d.name}
                      </td>
                      <td className="px-1.5 py-1 text-right text-[10px] text-muted-foreground tabular-nums">
                        {d.finite}/{d.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection
        title="Clustering"
        subtitle={
          clusteringMethod === "kmeans"
            ? `k-means · k=${parsedK}`
            : "Off — PCA only"
        }
        defaultOpen={true}
      >
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
                <span className="text-xs">Off (no clustering)</span>
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
        <p className="text-[10px] text-muted-foreground px-0.5 leading-tight">
          Will run:{" "}
          <span className="text-foreground font-medium">
            PCA
            {clusteringMethod === "kmeans" ? ` + k-means (k=${parsedK})` : ""}
          </span>
        </p>

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

        {pcaResult && !computeError && (
          <p className="text-[9px] text-muted-foreground px-0.5 truncate">
            {axes[0]} · {axes[1]}
          </p>
        )}
      </SidebarSection>

      <SidebarSection
        title="Map"
        defaultOpen={true}
        className="flex-1 min-h-0 flex flex-col"
        contentClassName="flex-1 min-h-0 flex flex-col"
      >
        {pcaResult ? (
          <div ref={setPlotDiv} className="flex-1 min-h-0" />
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
