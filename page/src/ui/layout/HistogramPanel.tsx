import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  type HistogramResult,
  type Molvis,
  computeHistogram,
  discoverNumericColumns,
} from "@molvis/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface HistogramPanelProps {
  app: Molvis | null;
}

interface ColumnInfo {
  name: string;
  dtype: string;
}

export const HistogramPanel: React.FC<HistogramPanelProps> = ({ app }) => {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [bins, setBins] = useState(30);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [result, setResult] = useState<HistogramResult | null>(null);

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

    if (!selectedColumn || !cols.some((c) => c.name === selectedColumn)) {
      return;
    }

    const data = atoms.getColumnF32(selectedColumn);
    if (!data) {
      setResult(null);
      return;
    }

    const indices = selectedOnly
      ? app.world.selectionManager.getSelectedAtomIds()
      : null;

    setResult(computeHistogram(data, bins, null, indices));
  }, [app, selectedColumn, bins, selectedOnly]);

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
      {/* Column selector */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Property</Label>
        <Select
          value={selectedColumn || "__none__"}
          onValueChange={(v) => setSelectedColumn(v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select column..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">(none)</span>
            </SelectItem>
            {columns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                <span className="font-mono">{col.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {col.dtype}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bins + selected only */}
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px]">Bins ({bins})</Label>
          <Slider
            min={5}
            max={100}
            step={1}
            value={[bins]}
            onValueChange={([v]) => setBins(v)}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Label className="text-[10px]">Selected</Label>
          <Switch
            checked={selectedOnly}
            onCheckedChange={setSelectedOnly}
          />
        </div>
      </div>

      {/* Histogram chart */}
      {result && result.stats.count > 0 && (
        <>
          <HistogramChart result={result} />
          <StatsDisplay stats={result.stats} />
        </>
      )}

      {selectedColumn && result && result.stats.count === 0 && (
        <div className="text-[9px] text-muted-foreground text-center py-2">
          No data for selected column.
        </div>
      )}

      {!selectedColumn && (
        <div className="text-[9px] text-muted-foreground text-center py-2">
          Select a numeric property to plot.
        </div>
      )}
    </div>
  );
};

// SVG Histogram Chart
const HistogramChart: React.FC<{ result: HistogramResult }> = ({ result }) => {
  const { counts, edges } = result;
  const maxCount = Math.max(...Array.from(counts));
  if (maxCount === 0) return null;

  const width = 280;
  const height = 120;
  const padding = { top: 8, right: 8, bottom: 20, left: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barCount = counts.length;
  const barWidth = plotW / barCount;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full border rounded bg-muted/10"
    >
      {/* Bars */}
      {Array.from(counts).map((count, i) => {
        const barH = (count / maxCount) * plotH;
        const x = padding.left + i * barWidth;
        const y = padding.top + plotH - barH;
        return (
          <rect
            key={`bar-${edges[i]}`}
            x={x}
            y={y}
            width={Math.max(barWidth - 1, 1)}
            height={barH}
            className="fill-blue-500/60"
          />
        );
      })}

      {/* X-axis labels */}
      <text
        x={padding.left}
        y={height - 2}
        className="fill-muted-foreground text-[7px]"
        textAnchor="start"
      >
        {formatAxisValue(edges[0])}
      </text>
      <text
        x={width - padding.right}
        y={height - 2}
        className="fill-muted-foreground text-[7px]"
        textAnchor="end"
      >
        {formatAxisValue(edges[edges.length - 1])}
      </text>

      {/* Y-axis max label */}
      <text
        x={padding.left + 2}
        y={padding.top + 8}
        className="fill-muted-foreground text-[7px]"
        textAnchor="start"
      >
        {maxCount}
      </text>
    </svg>
  );
};

const StatsDisplay: React.FC<{ stats: HistogramResult["stats"] }> = ({
  stats,
}) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
    <div>
      <span className="text-muted-foreground">count: </span>
      {stats.count}
    </div>
    <div>
      <span className="text-muted-foreground">mean: </span>
      {stats.mean.toFixed(3)}
    </div>
    <div>
      <span className="text-muted-foreground">min: </span>
      {stats.min.toFixed(3)}
    </div>
    <div>
      <span className="text-muted-foreground">max: </span>
      {stats.max.toFixed(3)}
    </div>
    <div>
      <span className="text-muted-foreground">std: </span>
      {stats.std.toFixed(3)}
    </div>
  </div>
);

function formatAxisValue(v: number): string {
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  if (Math.abs(v) >= 1000) return v.toExponential(1);
  return v.toFixed(2);
}
