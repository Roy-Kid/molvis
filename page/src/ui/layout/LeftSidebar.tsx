import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarSection } from "@/ui/layout/SidebarSection";
import {
  type Molvis,
  type RdfResult,
  type SelectionMask,
  computeRdf,
} from "@molvis/core";
import { AlertCircle, Download, Info, Play } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClusterPanel } from "./ClusterPanel";

interface LeftSidebarProps {
  app: Molvis | null;
}

type AnalysisType = "rdf" | "cluster";

const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: "rdf", label: "Radial distribution g(r)" },
  { value: "cluster", label: "Cluster analysis" },
];

/** Prevent pointer events from leaking to the BabylonJS canvas. */
const stopPointerPropagation = (e: React.PointerEvent) => {
  e.stopPropagation();
};

// ---------------------------------------------------------------------------
// Interactive RDF Chart with pan, zoom, and hover crosshair
// ---------------------------------------------------------------------------

const CHART_PAD = { top: 14, right: 14, bottom: 30, left: 40 };
const CHART_W = 400;
const CHART_H = 220;
const PLOT_W = CHART_W - CHART_PAD.left - CHART_PAD.right;
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
const CHART_GRADIENT_ID = "rdf-area-grad";

const niceStep = (range: number, targetTicks: number) => {
  const raw = range / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
};

const fmtAxis = (v: number) =>
  Math.abs(v) < 1e-10
    ? "0"
    : Math.abs(v) >= 100
      ? v.toFixed(0)
      : Math.abs(v) >= 1
        ? v.toFixed(1)
        : v.toFixed(2);

function RdfChart({ result }: { result: RdfResult }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<{
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  } | null>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    vb: NonNullable<typeof viewBox>;
  } | null>(null);

  const { r, gr, nBins, rMax } = result;

  let firstNonZero = 0;
  for (let i = 0; i < nBins; i++) {
    if (gr[i] > 0.01) {
      firstNonZero = i;
      break;
    }
  }
  const dataXMin = Math.max(0, r[firstNonZero] - result.dr);

  let dataYMax = 0;
  let peakIdx = -1;
  for (let i = firstNonZero; i < nBins; i++) {
    if (gr[i] > dataYMax) {
      dataYMax = gr[i];
      peakIdx = i;
    }
  }
  dataYMax = Math.max(dataYMax * 1.15, 1.5);

  const vb = viewBox ?? { xMin: dataXMin, xMax: rMax, yMin: 0, yMax: dataYMax };
  const xRange = vb.xMax - vb.xMin;
  const yRange = vb.yMax - vb.yMin;

  const toX = (rv: number) =>
    CHART_PAD.left + ((rv - vb.xMin) / xRange) * PLOT_W;
  const toY = (gv: number) =>
    CHART_PAD.top + PLOT_H - ((gv - vb.yMin) / yRange) * PLOT_H;

  const points: string[] = [];
  for (let i = 0; i < nBins; i++) {
    if (r[i] < vb.xMin || r[i] > vb.xMax) continue;
    points.push(`${toX(r[i]).toFixed(1)},${toY(gr[i]).toFixed(1)}`);
  }

  const refY = toY(1);
  const showRef = refY >= CHART_PAD.top && refY <= CHART_PAD.top + PLOT_H;

  const xStep = niceStep(xRange, 5);
  const yStep = niceStep(yRange, 4);
  const xTicks: number[] = [];
  for (let v = Math.ceil(vb.xMin / xStep) * xStep; v <= vb.xMax; v += xStep)
    xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = Math.ceil(vb.yMin / yStep) * yStep; v <= vb.yMax; v += yStep)
    yTicks.push(v);

  // ---- Hover snapping ----
  const eventToSvg = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      sx: ((e.clientX - rect.left) / rect.width) * CHART_W,
      sy: ((e.clientY - rect.top) / rect.height) * CHART_H,
      rect,
    };
  };

  const snapHover = (sx: number) => {
    const dataR = vb.xMin + ((sx - CHART_PAD.left) / PLOT_W) * xRange;
    let closest = -1;
    let closestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nBins; i++) {
      if (r[i] < vb.xMin || r[i] > vb.xMax) continue;
      const d = Math.abs(r[i] - dataR);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    }
    return closest;
  };

  // ---- Pan / zoom handlers ----
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      vb: { ...vb },
    };
    setHover(null);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = eventToSvg(e);
    if (!pos) return;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const xShift =
        (-dx / (pos.rect.width - CHART_PAD.left - CHART_PAD.right)) * xRange;
      const yShift =
        (dy / (pos.rect.height - CHART_PAD.top - CHART_PAD.bottom)) * yRange;
      const prev = dragRef.current.vb;
      setViewBox({
        xMin: prev.xMin + xShift,
        xMax: prev.xMax + xShift,
        yMin: prev.yMin + yShift,
        yMax: prev.yMax + yShift,
      });
      return;
    }
    if (
      pos.sx < CHART_PAD.left ||
      pos.sx > CHART_PAD.left + PLOT_W ||
      pos.sy < CHART_PAD.top ||
      pos.sy > CHART_PAD.top + PLOT_H
    ) {
      if (hover) setHover(null);
      return;
    }
    const idx = snapHover(pos.sx);
    if (idx >= 0 && (!hover || hover.idx !== idx)) setHover({ idx });
  };
  const handleMouseUp = () => {
    dragRef.current = null;
  };
  const handleMouseLeave = () => {
    dragRef.current = null;
    setHover(null);
  };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx =
      (e.clientX - rect.left - CHART_PAD.left) /
      (rect.width - CHART_PAD.left - CHART_PAD.right);
    const my =
      1 -
      (e.clientY - rect.top - CHART_PAD.top) /
        (rect.height - CHART_PAD.top - CHART_PAD.bottom);
    const cx = vb.xMin + mx * xRange;
    const cy = vb.yMin + my * yRange;
    setViewBox({
      xMin: cx - (cx - vb.xMin) * factor,
      xMax: cx + (vb.xMax - cx) * factor,
      yMin: cy - (cy - vb.yMin) * factor,
      yMax: cy + (vb.yMax - cy) * factor,
    });
  };
  const handleDoubleClick = () => setViewBox(null);

  // ---- Annotations ----
  const peakInView =
    peakIdx >= 0 && r[peakIdx] >= vb.xMin && r[peakIdx] <= vb.xMax;
  const peakSx = peakInView ? toX(r[peakIdx]) : 0;
  const peakSy = peakInView ? toY(gr[peakIdx]) : 0;

  const hoverPoint =
    hover && r[hover.idx] >= vb.xMin && r[hover.idx] <= vb.xMax
      ? {
          sx: toX(r[hover.idx]),
          sy: toY(gr[hover.idx]),
          r: r[hover.idx],
          gr: gr[hover.idx],
        }
      : null;

  // ---- Tooltip box (clamped to plot bounds) ----
  const TIP_W = 96;
  const TIP_H = 30;
  let tipX = 0;
  let tipY = 0;
  if (hoverPoint) {
    tipX = hoverPoint.sx + 8;
    if (tipX + TIP_W > CHART_PAD.left + PLOT_W)
      tipX = hoverPoint.sx - TIP_W - 8;
    tipY = hoverPoint.sy - TIP_H - 6;
    if (tipY < CHART_PAD.top) tipY = hoverPoint.sy + 8;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full border rounded bg-muted/10 cursor-crosshair active:cursor-grabbing select-none text-foreground"
      role="img"
      aria-label="RDF g(r) chart"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <defs>
        <clipPath id="plot-clip">
          <rect
            x={CHART_PAD.left}
            y={CHART_PAD.top}
            width={PLOT_W}
            height={PLOT_H}
          />
        </clipPath>
        <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.32} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines (subtle, behind everything) */}
      <g clipPath="url(#plot-clip)">
        {yTicks.map((v) => (
          <line
            key={`yg-${v}`}
            x1={CHART_PAD.left}
            y1={toY(v)}
            x2={CHART_PAD.left + PLOT_W}
            y2={toY(v)}
            stroke="currentColor"
            strokeOpacity={0.06}
          />
        ))}
        {showRef && (
          <line
            x1={CHART_PAD.left}
            y1={refY}
            x2={CHART_PAD.left + PLOT_W}
            y2={refY}
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeDasharray="4 3"
          />
        )}
      </g>

      {/* Axes */}
      <line
        x1={CHART_PAD.left}
        y1={CHART_PAD.top}
        x2={CHART_PAD.left}
        y2={CHART_PAD.top + PLOT_H}
        stroke="currentColor"
        strokeOpacity={0.35}
      />
      <line
        x1={CHART_PAD.left}
        y1={CHART_PAD.top + PLOT_H}
        x2={CHART_PAD.left + PLOT_W}
        y2={CHART_PAD.top + PLOT_H}
        stroke="currentColor"
        strokeOpacity={0.35}
      />

      {/* Tick marks + labels */}
      {yTicks.map((v) => (
        <g key={`yt-${v}`}>
          <line
            x1={CHART_PAD.left - 2}
            y1={toY(v)}
            x2={CHART_PAD.left}
            y2={toY(v)}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <text
            x={CHART_PAD.left - 4}
            y={toY(v) + 3}
            textAnchor="end"
            fontSize={8}
            fill="currentColor"
            opacity={0.5}
          >
            {fmtAxis(v)}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={`xt-${v}`}>
          <line
            x1={toX(v)}
            y1={CHART_PAD.top + PLOT_H}
            x2={toX(v)}
            y2={CHART_PAD.top + PLOT_H + 3}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <text
            x={toX(v)}
            y={CHART_PAD.top + PLOT_H + 14}
            textAnchor="middle"
            fontSize={8}
            fill="currentColor"
            opacity={0.5}
          >
            {fmtAxis(v)}
          </text>
        </g>
      ))}

      {/* Axis titles */}
      <text
        x={CHART_PAD.left + PLOT_W / 2}
        y={CHART_H - 2}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        opacity={0.55}
      >
        r ({"\u00C5"})
      </text>
      <text
        x={5}
        y={CHART_PAD.top + PLOT_H / 2}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        opacity={0.55}
        transform={`rotate(-90 5 ${CHART_PAD.top + PLOT_H / 2})`}
      >
        g(r)
      </text>

      {/* g(r) curve + filled area — accent color via wrapper text-* */}
      <g clipPath="url(#plot-clip)" className="text-sky-600 dark:text-sky-400">
        {points.length > 1 && (
          <polygon
            fill={`url(#${CHART_GRADIENT_ID})`}
            points={`${toX(vb.xMin).toFixed(1)},${toY(0).toFixed(1)} ${points.join(" ")} ${toX(vb.xMax).toFixed(1)},${toY(0).toFixed(1)}`}
          />
        )}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(" ")}
        />
        {peakInView && !hoverPoint && (
          <g>
            <circle
              cx={peakSx}
              cy={peakSy}
              r={2.5}
              fill="currentColor"
              fillOpacity={0.9}
            />
            <text
              x={peakSx}
              y={peakSy - 6}
              textAnchor="middle"
              fontSize={8}
              fill="currentColor"
              opacity={0.85}
            >
              {`r₁ = ${r[peakIdx].toFixed(2)} Å`}
            </text>
          </g>
        )}
      </g>

      {/* Hover crosshair + snap dot + tooltip */}
      {hoverPoint && (
        <g>
          <line
            x1={hoverPoint.sx}
            y1={CHART_PAD.top}
            x2={hoverPoint.sx}
            y2={CHART_PAD.top + PLOT_H}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="3 3"
          />
          <line
            x1={CHART_PAD.left}
            y1={hoverPoint.sy}
            x2={CHART_PAD.left + PLOT_W}
            y2={hoverPoint.sy}
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeDasharray="3 3"
          />
          <g className="text-sky-600 dark:text-sky-400">
            <circle
              cx={hoverPoint.sx}
              cy={hoverPoint.sy}
              r={4}
              fill="currentColor"
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
            />
          </g>
          {/* X-axis value badge */}
          <g>
            <rect
              x={hoverPoint.sx - 18}
              y={CHART_PAD.top + PLOT_H + 1}
              width={36}
              height={12}
              rx={2}
              fill="hsl(var(--popover))"
              stroke="currentColor"
              strokeOpacity={0.3}
            />
            <text
              x={hoverPoint.sx}
              y={CHART_PAD.top + PLOT_H + 9}
              textAnchor="middle"
              fontSize={8}
              fill="currentColor"
              opacity={0.85}
            >
              {hoverPoint.r.toFixed(2)}
            </text>
          </g>
          {/* Tooltip box */}
          <g>
            <rect
              x={tipX}
              y={tipY}
              width={TIP_W}
              height={TIP_H}
              rx={3}
              fill="hsl(var(--popover))"
              stroke="currentColor"
              strokeOpacity={0.35}
            />
            <text
              x={tipX + 6}
              y={tipY + 12}
              fontSize={9}
              fill="currentColor"
              opacity={0.7}
            >
              r
            </text>
            <text
              x={tipX + TIP_W - 6}
              y={tipY + 12}
              textAnchor="end"
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="currentColor"
            >
              {`${hoverPoint.r.toFixed(3)} Å`}
            </text>
            <text
              x={tipX + 6}
              y={tipY + 24}
              fontSize={9}
              fill="currentColor"
              opacity={0.7}
            >
              g(r)
            </text>
            <text
              x={tipX + TIP_W - 6}
              y={tipY + 24}
              textAnchor="end"
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="currentColor"
            >
              {hoverPoint.gr.toFixed(3)}
            </text>
          </g>
        </g>
      )}

      <text
        x={CHART_PAD.left + PLOT_W - 2}
        y={CHART_PAD.top + 10}
        textAnchor="end"
        fontSize={7}
        fill="currentColor"
        opacity={0.3}
      >
        hover · drag pan · scroll zoom · dblclick reset
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RDF Raw Data Table
// ---------------------------------------------------------------------------

const TABLE_ROW_HEIGHT = 20;
const TABLE_OVERSCAN = 5;

function downloadCsv(result: RdfResult) {
  const { r, gr, counts, nBins } = result;
  const lines = ["r,g(r),counts"];
  for (let i = 0; i < nBins; i++) {
    lines.push(`${r[i]},${gr[i]},${counts[i]}`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rdf.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function RdfTable({ result }: { result: RdfResult }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { r, gr, counts, nBins } = result;

  const totalHeight = nBins * TABLE_ROW_HEIGHT;
  const visibleCount = containerRef.current
    ? Math.ceil(containerRef.current.clientHeight / TABLE_ROW_HEIGHT)
    : 30;
  const startIdx = Math.max(
    0,
    Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN,
  );
  const endIdx = Math.min(nBins, startIdx + visibleCount + TABLE_OVERSCAN * 2);
  const offsetY = startIdx * TABLE_ROW_HEIGHT;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const fmt = (v: number) => {
    if (Math.abs(v) < 1e-6) return "0";
    if (Math.abs(v) >= 100) return v.toFixed(2);
    if (Math.abs(v) >= 1) return v.toFixed(4);
    return v.toExponential(3);
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: Math.min(nBins * TABLE_ROW_HEIGHT + 24, 300) }}
    >
      <div className="flex bg-muted/30 border-b text-[9px] font-semibold text-muted-foreground shrink-0">
        <div className="w-8 px-0.5 py-0.5 text-right shrink-0">#</div>
        <div className="flex-1 min-w-[52px] px-0.5 py-0.5">r</div>
        <div className="flex-1 min-w-[52px] px-0.5 py-0.5">g(r)</div>
        <div className="flex-1 min-w-[52px] px-0.5 py-0.5">counts</div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}
          >
            {Array.from({ length: endIdx - startIdx }, (_, offset) => {
              const i = startIdx + offset;
              return (
                <div
                  key={i}
                  className="flex text-[9px] font-mono hover:bg-muted/30 border-b border-muted/5"
                  style={{ height: TABLE_ROW_HEIGHT }}
                >
                  <div className="w-8 px-0.5 flex items-center justify-end text-muted-foreground shrink-0">
                    {i}
                  </div>
                  <div className="flex-1 min-w-[52px] px-0.5 flex items-center truncate">
                    {fmt(r[i])}
                  </div>
                  <div className="flex-1 min-w-[52px] px-0.5 flex items-center truncate">
                    {fmt(gr[i])}
                  </div>
                  <div className="flex-1 min-w-[52px] px-0.5 flex items-center truncate">
                    {counts[i]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full text-xs gap-1.5 mt-1"
        onClick={() => downloadCsv(result)}
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RDF Panel
// ---------------------------------------------------------------------------

interface ModifierOption {
  id: string;
  label: string;
  count: number;
}

function formatVolume(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 100 ? v.toFixed(2) : v.toFixed(4);
}

// Threshold below which a user-typed volume is treated as "unchanged from box".
const VOLUME_OVERRIDE_EPSILON = 1e-6;

function RdfPanel({ app }: { app: Molvis | null }) {
  const [modifiers, setModifiers] = useState<ModifierOption[]>([]);
  const [groupA, setGroupA] = useState("");
  const [groupB, setGroupB] = useState("");
  const [nBins, setNBins] = useState("100");
  const [rMin, setRMin] = useState("0");
  const [rMax, setRMax] = useState("");
  const [volume, setVolume] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [result, setResult] = useState<RdfResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectionsRef = useRef<Map<string, SelectionMask>>(new Map());

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
      if (opts.length > 0 && !groupA) {
        setGroupA(opts[0].id);
        setGroupB(opts[0].id);
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
  }, [app, groupA]);

  useEffect(() => {
    if (!app) return;
    // `frame.simbox` yields a fresh Box wrapper on every access, so compare by
    // the numeric volume (stable across ticks) and free the transient wrapper.
    let lastVolume: number | null = Number.NaN;
    const syncBoxVolume = () => {
      const box = app.system.frame?.simbox;
      const v = box ? box.volume() : null;
      box?.free();
      if (v === lastVolume) return;
      lastVolume = v;
      if (v !== null) {
        setHasBox(true);
        setVolume(formatVolume(v));
      } else {
        setHasBox(false);
        setVolume("");
      }
    };
    syncBoxVolume();
    return app.events.on("frame-change", syncBoxVolume);
  }, [app]);

  const handleGroupAChange = (val: string) => {
    setGroupA(val);
    if (!groupB || groupB === groupA) setGroupB(val);
  };

  const handleCompute = useCallback(() => {
    if (!app) return;
    const frame = app.system.frame;
    if (!frame) return;
    const maskA = selectionsRef.current.get(groupA);
    const maskB = selectionsRef.current.get(groupB);
    if (!maskA) {
      setError("Group A selection not found.");
      return;
    }
    if (!maskB) {
      setError("Group B selection not found.");
      return;
    }
    const indicesA = maskA.getIndices();
    const indicesB = maskB.getIndices();
    if (indicesA.length === 0) {
      setError("Group A is empty.");
      return;
    }
    if (indicesB.length === 0) {
      setError("Group B is empty.");
      return;
    }

    const parsedVolume =
      volume.trim() === "" ? Number.NaN : Number.parseFloat(volume);
    let volumeParam: number | undefined;
    if (hasBox) {
      const box = frame.simbox;
      const boxVol = box ? box.volume() : Number.NaN;
      box?.free();
      if (
        Number.isFinite(parsedVolume) &&
        parsedVolume > 0 &&
        Math.abs(parsedVolume - boxVol) > VOLUME_OVERRIDE_EPSILON
      ) {
        volumeParam = parsedVolume;
      }
    } else {
      if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
        setError("Non-periodic frame — enter a positive volume (Å³).");
        return;
      }
      volumeParam = parsedVolume;
    }

    const parsedRMin = Number.parseFloat(rMin);
    const rMinParam =
      Number.isFinite(parsedRMin) && parsedRMin >= 0 ? parsedRMin : 0;

    setComputing(true);
    setError(null);
    requestAnimationFrame(() => {
      try {
        const r = computeRdf(frame, {
          nBins: Math.max(10, Math.min(500, Number.parseInt(nBins, 10) || 100)),
          rMin: rMinParam,
          rMax: rMax ? Number.parseFloat(rMax) : undefined,
          volume: volumeParam,
          groupA: indicesA,
          groupB: indicesB,
        });
        if (!r) {
          setError("Not enough atoms to compute RDF.");
        } else {
          setResult(r);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "RDF computation failed");
      } finally {
        setComputing(false);
      }
    });
  }, [app, groupA, groupB, nBins, rMin, rMax, volume, hasBox]);

  const isSelf = groupA === groupB;
  const noModifiers = modifiers.length === 0;
  const volumeBlank = volume.trim() === "";
  const volumeMissing = !hasBox && volumeBlank;
  const computeDisabled = computing || !groupA || volumeMissing;

  return (
    <>
      <SidebarSection
        title="RDF"
        subtitle={noModifiers ? undefined : isSelf ? "Self g(r)" : "Cross g(r)"}
        defaultOpen={true}
      >
        {noModifiers ? (
          <p className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight px-0.5">
            <Info className="h-3 w-3 shrink-0 mt-px" />
            <span>Add a selection modifier to choose groups</span>
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                Group A
              </span>
              <Select value={groupA} onValueChange={handleGroupAChange}>
                <SelectTrigger className="h-7 flex-1 min-w-0 px-2 text-xs">
                  <SelectValue placeholder="Choose modifier" />
                </SelectTrigger>
                <SelectContent>
                  {modifiers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="text-xs">
                        {m.label}
                        <span className="ml-1 text-muted-foreground">
                          ({m.count})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                Group B
              </span>
              <Select value={groupB} onValueChange={setGroupB}>
                <SelectTrigger className="h-7 flex-1 min-w-0 px-2 text-xs">
                  <SelectValue placeholder="Choose modifier" />
                </SelectTrigger>
                <SelectContent>
                  {modifiers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="text-xs">
                        {m.label}
                        <span className="ml-1 text-muted-foreground">
                          ({m.count})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                Bins
              </span>
              <Input
                className="h-7 flex-1 min-w-0 text-xs font-mono"
                value={nBins}
                onChange={(e) => setNBins(e.target.value)}
                placeholder="100"
                aria-label="Number of bins"
              />
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground pl-1">
                r_min
              </span>
              <Input
                className="h-7 flex-1 min-w-0 text-xs font-mono"
                value={rMin}
                onChange={(e) => setRMin(e.target.value)}
                placeholder="0"
                aria-label="r_min"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">
                r_max
              </span>
              <Input
                className="h-7 flex-1 min-w-0 text-xs font-mono"
                value={rMax}
                onChange={(e) => setRMax(e.target.value)}
                placeholder="auto"
                aria-label="r_max"
              />
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground pl-1">
                Volume
              </span>
              <Input
                className="h-7 flex-1 min-w-0 text-xs font-mono"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder={hasBox ? "from box" : "required (Å³)"}
                aria-label="Normalization volume in cubic angstrom"
              />
            </div>

            {volumeMissing && (
              <p className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight px-0.5">
                <Info className="h-3 w-3 shrink-0 mt-px" />
                <span>Non-periodic frame — enter a volume in Å³</span>
              </p>
            )}

            <Button
              size="sm"
              className="h-7 w-full text-xs gap-1.5"
              onClick={handleCompute}
              disabled={computeDisabled}
            >
              <Play className="h-3.5 w-3.5" />
              {computing
                ? "Computing…"
                : isSelf
                  ? "Compute self-RDF"
                  : "Compute cross-RDF"}
            </Button>

            {error && (
              <p className="flex items-start gap-1 text-[10px] text-destructive leading-tight px-0.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-px" />
                <span className="truncate">{error}</span>
              </p>
            )}
          </>
        )}
      </SidebarSection>

      {result && (
        <>
          <SidebarSection
            title="Result"
            subtitle={`${result.nParticles} atoms · dr=${result.dr.toFixed(3)} · r_max=${result.rMax.toFixed(1)}`}
            defaultOpen={true}
          >
            <RdfChart result={result} />
          </SidebarSection>

          <SidebarSection
            title="Raw Data"
            subtitle={`${result.nBins} bins`}
            defaultOpen={false}
          >
            <RdfTable result={result} />
          </SidebarSection>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// LeftSidebar — Analysis panel with type selector
// ---------------------------------------------------------------------------

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ app }) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>("rdf");

  return (
    <div
      className="h-full w-full bg-background flex flex-col border-r"
      onPointerDown={stopPointerPropagation}
    >
      <div className="border-b bg-muted/15 shrink-0 flex items-center gap-1.5 px-2 py-1">
        <span className="text-[10px] font-semibold tracking-wide uppercase shrink-0">
          Analysis
        </span>
        <Select
          value={analysisType}
          onValueChange={(v) => setAnalysisType(v as AnalysisType)}
        >
          <SelectTrigger
            className="h-7 flex-1 min-w-0 px-2 text-xs"
            aria-label="Analysis type"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANALYSIS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                <span className="text-xs">{label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {analysisType === "rdf" && <RdfPanel app={app} />}
        {analysisType === "cluster" && <ClusterPanel app={app} />}
      </div>
    </div>
  );
};
