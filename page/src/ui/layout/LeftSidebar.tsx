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
import { Download, Play } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClusterPanel } from "./ClusterPanel";

interface LeftSidebarProps {
  app: Molvis | null;
}

type AnalysisType = "rdf" | "cluster";

/** Prevent pointer events from leaking to the BabylonJS canvas. */
const stopPointerPropagation = (e: React.PointerEvent) => {
  e.stopPropagation();
};

// ---------------------------------------------------------------------------
// Interactive RDF Chart with pan & zoom
// ---------------------------------------------------------------------------

const CHART_PAD = { top: 14, right: 14, bottom: 30, left: 40 };

function RdfChart({ result }: { result: RdfResult }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<{
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  } | null>(null);
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
  for (let i = firstNonZero; i < nBins; i++) {
    if (gr[i] > dataYMax) dataYMax = gr[i];
  }
  dataYMax = Math.max(dataYMax * 1.15, 1.5);

  const vb = viewBox ?? { xMin: dataXMin, xMax: rMax, yMin: 0, yMax: dataYMax };
  const xRange = vb.xMax - vb.xMin;
  const yRange = vb.yMax - vb.yMin;

  const getSize = () => {
    const el = svgRef.current;
    if (!el) return { w: 300, h: 180 };
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  };

  const svgW = 400;
  const svgH = 220;
  const pw = svgW - CHART_PAD.left - CHART_PAD.right;
  const ph = svgH - CHART_PAD.top - CHART_PAD.bottom;

  const toX = (rv: number) => CHART_PAD.left + ((rv - vb.xMin) / xRange) * pw;
  const toY = (gv: number) =>
    CHART_PAD.top + ph - ((gv - vb.yMin) / yRange) * ph;

  const points: string[] = [];
  for (let i = 0; i < nBins; i++) {
    if (r[i] < vb.xMin || r[i] > vb.xMax) continue;
    points.push(`${toX(r[i]).toFixed(1)},${toY(gr[i]).toFixed(1)}`);
  }

  const refY = toY(1);
  const showRef = refY >= CHART_PAD.top && refY <= CHART_PAD.top + ph;

  const niceStep = (range: number, targetTicks: number) => {
    const raw = range / targetTicks;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  };

  const xStep = niceStep(xRange, 5);
  const yStep = niceStep(yRange, 4);
  const xTicks: number[] = [];
  for (let v = Math.ceil(vb.xMin / xStep) * xStep; v <= vb.xMax; v += xStep)
    xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = Math.ceil(vb.yMin / yStep) * yStep; v <= vb.yMax; v += yStep)
    yTicks.push(v);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, vb: { ...vb } };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const size = getSize();
    const xShift = (-dx / (size.w - CHART_PAD.left - CHART_PAD.right)) * xRange;
    const yShift = (dy / (size.h - CHART_PAD.top - CHART_PAD.bottom)) * yRange;
    const prev = dragRef.current.vb;
    setViewBox({
      xMin: prev.xMin + xShift,
      xMax: prev.xMax + xShift,
      yMin: prev.yMin + yShift,
      yMax: prev.yMax + yShift,
    });
  };
  const handleMouseUp = () => {
    dragRef.current = null;
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

  const fmt = (v: number) =>
    Math.abs(v) < 1e-10
      ? "0"
      : Math.abs(v) >= 100
        ? v.toFixed(0)
        : Math.abs(v) >= 1
          ? v.toFixed(1)
          : v.toFixed(2);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full border rounded bg-muted/10 cursor-grab active:cursor-grabbing select-none"
      role="img"
      aria-label="RDF g(r) chart"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <defs>
        <clipPath id="plot-clip">
          <rect x={CHART_PAD.left} y={CHART_PAD.top} width={pw} height={ph} />
        </clipPath>
      </defs>
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
      {showRef && (
        <line
          x1={CHART_PAD.left}
          y1={refY}
          x2={CHART_PAD.left + pw}
          y2={refY}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeDasharray="4 3"
          clipPath="url(#plot-clip)"
        />
      )}
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
            {fmt(v)}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={`xt-${v}`}>
          <line
            x1={toX(v)}
            y1={CHART_PAD.top + ph}
            x2={toX(v)}
            y2={CHART_PAD.top + ph + 3}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          <text
            x={toX(v)}
            y={CHART_PAD.top + ph + 14}
            textAnchor="middle"
            fontSize={8}
            fill="currentColor"
            opacity={0.4}
          >
            {fmt(v)}
          </text>
        </g>
      ))}
      <text
        x={CHART_PAD.left + pw / 2}
        y={svgH - 2}
        textAnchor="middle"
        fontSize={9}
        fill="currentColor"
        opacity={0.5}
      >
        r ({"\u00C5"})
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
        g(r)
      </text>
      <g clipPath="url(#plot-clip)">
        {points.length > 1 && (
          <polygon
            fill="#3b82f6"
            fillOpacity={0.08}
            points={`${toX(vb.xMin).toFixed(1)},${toY(0).toFixed(1)} ${points.join(" ")} ${toX(vb.xMax).toFixed(1)},${toY(0).toFixed(1)}`}
          />
        )}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          points={points.join(" ")}
        />
      </g>
      <text
        x={CHART_PAD.left + pw - 2}
        y={CHART_PAD.top + 10}
        textAnchor="end"
        fontSize={7}
        fill="currentColor"
        opacity={0.2}
      >
        drag · scroll zoom · dblclick reset
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
        className="h-6 w-full text-[10px] gap-1 mt-1"
        onClick={() => downloadCsv(result)}
      >
        <Download className="h-3 w-3" />
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

function RdfPanel({ app }: { app: Molvis | null }) {
  const [modifiers, setModifiers] = useState<ModifierOption[]>([]);
  const [groupA, setGroupA] = useState("");
  const [groupB, setGroupB] = useState("");
  const [nBins, setNBins] = useState("100");
  const [rMax, setRMax] = useState("");
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
    setComputing(true);
    setError(null);
    requestAnimationFrame(() => {
      try {
        const r = computeRdf(frame, {
          nBins: Math.max(10, Math.min(500, Number.parseInt(nBins, 10) || 100)),
          rMax: rMax ? Number.parseFloat(rMax) : undefined,
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
  }, [app, groupA, groupB, nBins, rMax]);

  const isSelf = groupA === groupB;

  return (
    <>
      <SidebarSection
        title="RDF"
        subtitle={isSelf ? "Self g(r)" : "Cross g(r)"}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[52px_1fr] gap-1.5 items-center">
            <span className="text-[10px] text-muted-foreground">Group A</span>
            <Select value={groupA} onValueChange={handleGroupAChange}>
              <SelectTrigger className="h-6 text-[11px]" size="sm">
                <SelectValue
                  placeholder={
                    modifiers.length === 0
                      ? "No modifier yet"
                      : "Choose modifier..."
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

            <span className="text-[10px] text-muted-foreground">Group B</span>
            <Select value={groupB} onValueChange={setGroupB}>
              <SelectTrigger className="h-6 text-[11px]" size="sm">
                <SelectValue
                  placeholder={
                    modifiers.length === 0
                      ? "No modifier yet"
                      : "Choose modifier..."
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

            <span className="text-[10px] text-muted-foreground">Bins</span>
            <Input
              className="h-6 text-[11px] font-mono"
              value={nBins}
              onChange={(e) => setNBins(e.target.value)}
              placeholder="100"
            />

            <span className="text-[10px] text-muted-foreground">r_max</span>
            <Input
              className="h-6 text-[11px] font-mono"
              value={rMax}
              onChange={(e) => setRMax(e.target.value)}
              placeholder="auto"
            />
          </div>

          <Button
            size="sm"
            className="h-7 w-full text-[11px] gap-1"
            onClick={handleCompute}
            disabled={computing || !groupA}
          >
            <Play className="h-3 w-3" />
            {computing
              ? "Computing..."
              : isSelf
                ? "Compute self-RDF"
                : "Compute cross-RDF"}
          </Button>

          {error && (
            <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1">
              {error}
            </div>
          )}
        </div>
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
      <div className="h-7 px-2 border-b bg-muted/10 shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wide uppercase shrink-0">
          Analysis
        </span>
        <Select
          value={analysisType}
          onValueChange={(v) => setAnalysisType(v as AnalysisType)}
        >
          <SelectTrigger className="h-5 text-[10px] flex-1 min-w-0" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rdf" className="text-[11px]">
              Radial Distribution Function
            </SelectItem>
            <SelectItem value="cluster" className="text-[11px]">
              Cluster Analysis
            </SelectItem>
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
