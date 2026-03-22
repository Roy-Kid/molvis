import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  type Molvis,
  type ScatterResult,
  discoverNumericColumns,
  prepareScatter,
} from "@molvis/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface ScatterPlotPanelProps {
  app: Molvis | null;
}

interface ColumnInfo {
  name: string;
  dtype: string;
}

export const ScatterPlotPanel: React.FC<ScatterPlotPanelProps> = ({ app }) => {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [result, setResult] = useState<ScatterResult | null>(null);

  const refresh = useCallback(() => {
    if (!app) return;
    const frame = app.system.frame;
    const atoms = frame?.getBlock("atoms");
    if (!atoms || atoms.nrows() === 0) {
      setColumns([]);
      setResult(null);
      return;
    }

    const cols = discoverNumericColumns(atoms);
    setColumns(cols);

    if (!xCol || !yCol) {
      setResult(null);
      return;
    }

    const xData = atoms.viewColF32(xCol);
    const yData = atoms.viewColF32(yCol);
    if (!xData || !yData) {
      setResult(null);
      return;
    }

    const indices = selectedOnly
      ? app.world.selectionManager.getSelectedAtomIds()
      : null;

    setResult(prepareScatter(xData, yData, 2000, indices));
  }, [app, xCol, yCol, selectedOnly]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!app) return;
    const onFrame = () => refresh();
    app.events.on("frame-rendered", onFrame);
    app.world.selectionManager.on("selection-change", onFrame);
    return () => {
      app.events.off("frame-rendered", onFrame);
      app.world.selectionManager.off("selection-change", onFrame);
    };
  }, [app, refresh]);

  return (
    <div className="flex flex-col gap-2 p-2 h-full overflow-y-auto">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground">X axis</Label>
          <Select
            value={xCol || "__none__"}
            onValueChange={(v) => setXCol(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-6 text-[10px]">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">(none)</span>
              </SelectItem>
              {columns.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  <span className="font-mono">{col.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground">Y axis</Label>
          <Select
            value={yCol || "__none__"}
            onValueChange={(v) => setYCol(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-6 text-[10px]">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">(none)</span>
              </SelectItem>
              {columns.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  <span className="font-mono">{col.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-[9px]">Selected only</Label>
          <Switch checked={selectedOnly} onCheckedChange={setSelectedOnly} />
        </div>
        {result && (
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {result.sampledCount === result.totalCount
              ? `${result.totalCount} pts`
              : `${result.sampledCount}/${result.totalCount} pts`}
          </span>
        )}
      </div>

      {result && result.points.length > 0 && (
        <ScatterChart result={result} xLabel={xCol} yLabel={yCol} />
      )}

      {xCol && yCol && result && result.points.length === 0 && (
        <div className="text-[9px] text-muted-foreground text-center py-2">
          No data.
        </div>
      )}

      {(!xCol || !yCol) && (
        <div className="text-[9px] text-muted-foreground text-center py-2">
          Select X and Y columns to plot.
        </div>
      )}
    </div>
  );
};

const ScatterChart: React.FC<{
  result: ScatterResult;
  xLabel: string;
  yLabel: string;
}> = ({ result, xLabel, yLabel }) => {
  const width = 280;
  const height = 200;
  const pad = { top: 8, right: 8, bottom: 18, left: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { xRange, yRange, points } = result;
  const xSpan = xRange.max - xRange.min || 1;
  const ySpan = yRange.max - yRange.min || 1;

  const toX = (v: number) => pad.left + ((v - xRange.min) / xSpan) * plotW;
  const toY = (v: number) =>
    pad.top + plotH - ((v - yRange.min) / ySpan) * plotH;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full border rounded bg-muted/10"
      role="img"
      aria-label="Scatter plot chart"
    >
      {/* Grid lines */}
      <line
        x1={pad.left}
        y1={pad.top + plotH}
        x2={pad.left + plotW}
        y2={pad.top + plotH}
        className="stroke-muted-foreground/20"
        strokeWidth={0.5}
      />
      <line
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + plotH}
        className="stroke-muted-foreground/20"
        strokeWidth={0.5}
      />

      {/* Points */}
      {points.map((pt) => (
        <circle
          key={pt.index}
          cx={toX(pt.x)}
          cy={toY(pt.y)}
          r={1.5}
          className="fill-blue-400/70"
        />
      ))}

      {/* X axis labels */}
      <text
        x={pad.left}
        y={height - 2}
        className="fill-muted-foreground text-[6px]"
        textAnchor="start"
      >
        {fmtAxis(xRange.min)}
      </text>
      <text
        x={pad.left + plotW}
        y={height - 2}
        className="fill-muted-foreground text-[6px]"
        textAnchor="end"
      >
        {fmtAxis(xRange.max)}
      </text>
      <text
        x={pad.left + plotW / 2}
        y={height - 2}
        className="fill-muted-foreground text-[6px]"
        textAnchor="middle"
      >
        {xLabel}
      </text>

      {/* Y axis labels */}
      <text
        x={pad.left - 2}
        y={pad.top + plotH}
        className="fill-muted-foreground text-[6px]"
        textAnchor="end"
      >
        {fmtAxis(yRange.min)}
      </text>
      <text
        x={pad.left - 2}
        y={pad.top + 6}
        className="fill-muted-foreground text-[6px]"
        textAnchor="end"
      >
        {fmtAxis(yRange.max)}
      </text>
      <text
        x={4}
        y={pad.top + plotH / 2}
        className="fill-muted-foreground text-[6px]"
        textAnchor="middle"
        transform={`rotate(-90, 4, ${pad.top + plotH / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
};

function fmtAxis(v: number): string {
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(1);
}
