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
  type ClusterResult,
  type ConnectivityMode,
  type Molvis,
  type SelectionMask,
  computeClusters,
  getCategoricalPalette,
} from "@molvis/core";
import { Download, Play } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ClusterPanelProps {
  app: Molvis | null;
}

// ---------------------------------------------------------------------------
// Modifier option for "use only selected particles"
// ---------------------------------------------------------------------------

interface ModifierOption {
  id: string;
  label: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Cluster Size Distribution Chart
// ---------------------------------------------------------------------------

const CHART_PAD = { top: 10, right: 10, bottom: 28, left: 36 };

function ClusterSizeChart({ result }: { result: ClusterResult }) {
  const { clusterSizes, numClusters } = result;

  const sizeHistogram = new Map<number, number>();
  for (let c = 0; c < numClusters; c++) {
    const s = clusterSizes[c];
    sizeHistogram.set(s, (sizeHistogram.get(s) ?? 0) + 1);
  }

  const entries = Array.from(sizeHistogram.entries()).sort(
    (a, b) => a[0] - b[0],
  );
  if (entries.length === 0) return null;

  const maxCount = Math.max(...entries.map(([, c]) => c));

  const svgW = 400;
  const svgH = 160;
  const pw = svgW - CHART_PAD.left - CHART_PAD.right;
  const ph = svgH - CHART_PAD.top - CHART_PAD.bottom;

  const barWidth = Math.max(4, Math.min(24, pw / entries.length - 2));
  const totalBarsW = entries.length * (barWidth + 2);
  const barsOffset = CHART_PAD.left + Math.max(0, (pw - totalBarsW) / 2);
  const yScale = maxCount > 0 ? ph / (maxCount * 1.1) : 1;

  const niceStep = (range: number, ticks: number) => {
    const raw = range / ticks;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  };
  const yStep = maxCount > 4 ? niceStep(maxCount, 4) : 1;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxCount * 1.1; v += yStep) yTicks.push(Math.round(v));

  const toY = (count: number) => CHART_PAD.top + ph - count * yScale;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full border rounded bg-muted/10 select-none"
      role="img"
      aria-label="Cluster size distribution"
    >
      <line
        x1={CHART_PAD.left}
        y1={CHART_PAD.top}
        x2={CHART_PAD.left}
        y2={CHART_PAD.top + ph}
        stroke="currentColor"
        strokeOpacity={0.3}
      />
      <line
        x1={CHART_PAD.left}
        y1={CHART_PAD.top + ph}
        x2={CHART_PAD.left + pw}
        y2={CHART_PAD.top + ph}
        stroke="currentColor"
        strokeOpacity={0.3}
      />
      {yTicks.map((v) => (
        <g key={`yt-${v}`}>
          <line
            x1={CHART_PAD.left - 2}
            y1={toY(v)}
            x2={CHART_PAD.left}
            y2={toY(v)}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          <text
            x={CHART_PAD.left - 4}
            y={toY(v) + 3}
            textAnchor="end"
            fontSize={8}
            fill="currentColor"
            opacity={0.4}
          >
            {v}
          </text>
        </g>
      ))}
      {entries.map(([size, count], idx) => {
        const x = barsOffset + idx * (barWidth + 2);
        const barH = count * yScale;
        return (
          <g key={size}>
            <rect
              x={x}
              y={CHART_PAD.top + ph - barH}
              width={barWidth}
              height={barH}
              fill="#3b82f6"
              fillOpacity={0.6}
              rx={1}
            />
            {(entries.length <= 20 ||
              idx % Math.ceil(entries.length / 20) === 0) && (
              <text
                x={x + barWidth / 2}
                y={CHART_PAD.top + ph + 12}
                textAnchor="middle"
                fontSize={7}
                fill="currentColor"
                opacity={0.4}
              >
                {size}
              </text>
            )}
          </g>
        );
      })}
      <text
        x={CHART_PAD.left + pw / 2}
        y={svgH - 2}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        opacity={0.5}
      >
        cluster size
      </text>
      <text
        x={5}
        y={CHART_PAD.top + ph / 2}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        opacity={0.5}
        transform={`rotate(-90 5 ${CHART_PAD.top + ph / 2})`}
      >
        count
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Cluster Table
// ---------------------------------------------------------------------------

const TABLE_ROW_HEIGHT = 20;
const TABLE_OVERSCAN = 5;

interface ClusterRow {
  id: number;
  size: number;
}

function downloadClusterCsv(result: ClusterResult) {
  const { clusterIdx, clusterSizes, numClusters, nParticles } = result;
  const lines = ["atom_id,cluster_id"];
  for (let i = 0; i < nParticles; i++) {
    lines.push(`${i},${clusterIdx[i]}`);
  }
  lines.push("");
  lines.push("cluster_id,size");
  for (let c = 0; c < numClusters; c++) {
    lines.push(`${c},${clusterSizes[c]}`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clusters.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ClusterTable({ rows }: { rows: ClusterRow[] }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = rows.length * TABLE_ROW_HEIGHT;
  const visibleCount = containerRef.current
    ? Math.ceil(containerRef.current.clientHeight / TABLE_ROW_HEIGHT)
    : 20;
  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN,
  );
  const endIdx = Math.min(
    rows.length,
    startIdx + visibleCount + TABLE_OVERSCAN * 2,
  );
  const offsetY = startIdx * TABLE_ROW_HEIGHT;

  return (
    <div
      className="flex flex-col"
      style={{ height: Math.min(rows.length * TABLE_ROW_HEIGHT + 24, 260) }}
    >
      <div className="flex bg-muted/30 border-b text-[9px] font-semibold text-muted-foreground shrink-0">
        <div className="w-12 px-1 py-0.5 text-right shrink-0">Cluster</div>
        <div className="flex-1 min-w-[52px] px-1 py-0.5 text-right">Size</div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}
          >
            {Array.from({ length: endIdx - startIdx }, (_, offset) => {
              const i = startIdx + offset;
              const row = rows[i];
              return (
                <div
                  key={row.id}
                  className="flex text-[9px] font-mono hover:bg-muted/30 border-b border-muted/5"
                  style={{ height: TABLE_ROW_HEIGHT }}
                >
                  <div className="w-12 px-1 flex items-center justify-end text-muted-foreground shrink-0">
                    {row.id}
                  </div>
                  <div className="flex-1 min-w-[52px] px-1 flex items-center justify-end">
                    {row.size}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct GPU coloring (no pipeline modifier)
// ---------------------------------------------------------------------------

function colorAtomsByCluster(app: Molvis, result: ClusterResult) {
  const atomState = app.world.sceneIndex.meshRegistry.getAtomState();
  if (!atomState) return;

  const colorDesc = atomState.buffers.get("instanceColor");
  if (!colorDesc) return;

  const { clusterIdx, numClusters, nParticles } = result;
  const total = atomState.frameOffset + atomState.count;

  // Pre-compute one color per cluster
  const palette = getCategoricalPalette();
  const clusterColors = new Array<[number, number, number]>(numClusters);
  for (let c = 0; c < numClusters; c++) {
    clusterColors[c] = palette[c % palette.length];
  }

  // Unassigned atoms (cluster -1) get a dim gray
  const unassignedColor: [number, number, number] = [0.3, 0.3, 0.3];

  const count = Math.min(nParticles, total);
  for (let i = 0; i < count; i++) {
    const cid = clusterIdx[i];
    const rgb =
      cid >= 0 && cid < numClusters ? clusterColors[cid] : unassignedColor;
    const idx4 = i * 4;
    colorDesc.data[idx4 + 0] = rgb[0];
    colorDesc.data[idx4 + 1] = rgb[1];
    colorDesc.data[idx4 + 2] = rgb[2];
    // preserve existing alpha
  }

  atomState.uploadBuffer("instanceColor");
}

// ---------------------------------------------------------------------------
// ClusterPanel
// ---------------------------------------------------------------------------

export const ClusterPanel: React.FC<ClusterPanelProps> = ({ app }) => {
  // Config
  const [mode, setMode] = useState<ConnectivityMode>("cutoff");
  const [rMax, setRMax] = useState("3.2");
  const [minSize, setMinSize] = useState("1");

  // Options
  const [sortBySize, setSortBySize] = useState(true);
  const [colorByCluster, setColorByCluster] = useState(false);
  const [useSelection, setUseSelection] = useState(false);
  const [selectionModId, setSelectionModId] = useState("");

  // Selection modifiers tracking
  const [modifiers, setModifiers] = useState<ModifierOption[]>([]);
  const selectionsRef = useRef<Map<string, SelectionMask>>(new Map());

  // Result
  const [result, setResult] = useState<ClusterResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  // Track bonds availability
  const [hasBonds, setHasBonds] = useState(false);

  useEffect(() => {
    if (!app) return;
    const checkBonds = () => {
      const frame = app.system.frame;
      if (!frame) {
        setHasBonds(false);
        return;
      }
      const bonds = frame.getBlock("bonds");
      setHasBonds(bonds !== undefined && bonds !== null && bonds.nrows() > 0);
    };
    checkBonds();
    const unsub = app.events.on("frame-change", checkBonds);
    return unsub;
  }, [app]);

  // Track selection modifiers from pipeline
  useEffect(() => {
    if (!app) return;
    const update = () => {
      const selSet = app.selectionSet;
      selectionsRef.current = new Map(selSet);
      const pipelineMods = app.modifierPipeline.getModifiers();
      const opts: ModifierOption[] = [];
      for (const mod of pipelineMods) {
        const mask = selSet.get(mod.id);
        if (mask) {
          opts.push({ id: mod.id, label: mod.name, count: mask.count() });
        }
      }
      setModifiers(opts);
      if (opts.length > 0 && !selectionModId) {
        setSelectionModId(opts[0].id);
      }
    };
    const unsub1 = app.modifierPipeline.on("computed", update);
    const unsub2 = app.modifierPipeline.on("modifier-added", update);
    const unsub3 = app.modifierPipeline.on("modifier-removed", update);
    update();
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [app, selectionModId]);

  const handleCompute = useCallback(() => {
    if (!app) return;
    const frame = app.system.frame;
    if (!frame) {
      setError("No frame loaded.");
      return;
    }

    setComputing(true);
    setError(null);

    requestAnimationFrame(() => {
      try {
        // Gather selected indices if option is on
        let selectedIndices: number[] | undefined;
        if (useSelection && selectionModId) {
          const mask = selectionsRef.current.get(selectionModId);
          if (!mask || mask.count() === 0) {
            setError("Selected modifier has no atoms.");
            setComputing(false);
            return;
          }
          selectedIndices = mask.getIndices();
        }

        const r = computeClusters(frame, {
          mode,
          rMax:
            mode === "cutoff"
              ? rMax
                ? Number.parseFloat(rMax)
                : undefined
              : undefined,
          minClusterSize: Math.max(1, Number.parseInt(minSize, 10) || 1),
          sortBySize,
          selectedIndices,
        });

        if (!r) {
          setError("Cluster analysis failed.");
          setComputing(false);
          return;
        }

        setResult(r);

        if (colorByCluster) {
          colorAtomsByCluster(app, r);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cluster computation failed");
      } finally {
        setComputing(false);
      }
    });
  }, [
    app,
    mode,
    rMax,
    minSize,
    sortBySize,
    colorByCluster,
    useSelection,
    selectionModId,
  ]);

  // Cluster rows for table (already sorted by computeClusters if sortBySize=true)
  const clusterRows: ClusterRow[] = [];
  if (result) {
    for (let c = 0; c < result.numClusters; c++) {
      clusterRows.push({ id: c, size: result.clusterSizes[c] });
    }
  }

  return (
    <SidebarSection title="Cluster analysis" defaultOpen={true}>
      <div className="space-y-2.5">
        {/* Connectivity criterion */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-medium">
            Connectivity criterion:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="cluster-mode"
              checked={mode === "cutoff"}
              onChange={() => setMode("cutoff")}
              className="h-3 w-3 accent-primary"
            />
            <span className="text-[10px]">Cutoff distance</span>
            {mode === "cutoff" && (
              <Input
                className="h-5 text-[10px] font-mono w-16 ml-auto"
                value={rMax}
                onChange={(e) => setRMax(e.target.value)}
                placeholder="auto"
              />
            )}
          </label>

          <label
            className={`flex items-center gap-1.5 ${hasBonds ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
          >
            <input
              type="radio"
              name="cluster-mode"
              checked={mode === "bonds"}
              onChange={() => setMode("bonds")}
              disabled={!hasBonds}
              className="h-3 w-3 accent-primary"
            />
            <span className="text-[10px]">Bonds</span>
          </label>
        </div>

        {/* Min cluster size */}
        <div className="grid grid-cols-[72px_1fr] gap-1.5 items-center">
          <span className="text-[10px] text-muted-foreground">Min size</span>
          <Input
            className="h-5 text-[10px] font-mono"
            value={minSize}
            onChange={(e) => setMinSize(e.target.value)}
            placeholder="1"
          />
        </div>

        {/* Options */}
        <div className="space-y-1">
          <CheckboxRow
            id="cl-sort"
            checked={sortBySize}
            onCheckedChange={setSortBySize}
            label="Sort clusters by size"
          />
          <CheckboxRow
            id="cl-color"
            checked={colorByCluster}
            onCheckedChange={setColorByCluster}
            label="Color particles by cluster"
          />
          <CheckboxRow
            id="cl-sel"
            checked={useSelection}
            onCheckedChange={setUseSelection}
            label="Use only selected particles"
          />

          {/* Modifier selector — shown when "use selection" is checked */}
          {useSelection && (
            <div className="pl-5">
              <Select value={selectionModId} onValueChange={setSelectionModId}>
                <SelectTrigger className="h-5 text-[10px]" size="sm">
                  <SelectValue
                    placeholder={
                      modifiers.length === 0 ? "No modifier yet" : "Choose..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {modifiers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[11px]">
                      {m.label} ({m.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Compute */}
        <Button
          size="sm"
          className="h-7 w-full text-[11px] gap-1"
          onClick={handleCompute}
          disabled={computing}
        >
          <Play className="h-3 w-3" />
          {computing ? "Computing..." : "Compute"}
        </Button>

        {error && (
          <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="text-[10px] text-muted-foreground bg-muted/20 rounded px-2 py-1">
            Found{" "}
            <span className="text-foreground font-medium">
              {result.numClusters}
            </span>{" "}
            cluster(s).
          </div>
        )}

        {result && result.numClusters > 0 && (
          <>
            <ClusterSizeChart result={result} />

            <Button
              size="sm"
              variant="outline"
              className="h-6 w-full text-[10px]"
              onClick={() => setShowList((v) => !v)}
            >
              {showList ? "Hide list of clusters" : "Show list of clusters"}
            </Button>

            {showList && (
              <div className="space-y-1">
                <ClusterTable rows={clusterRows} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 w-full text-[10px] gap-1"
                  onClick={() => downloadClusterCsv(result)}
                >
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </SidebarSection>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="h-3.5 w-3.5"
      />
      <Label htmlFor={id} className="text-[10px] cursor-pointer leading-none">
        {label}
      </Label>
    </div>
  );
}
