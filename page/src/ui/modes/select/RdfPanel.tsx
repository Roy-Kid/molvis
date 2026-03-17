import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Molvis } from "@molvis/core";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { syntheticRdfAdapter } from "./rdf/adapter";
import type { RdfComputeAdapter, RdfParams, RdfResult } from "./rdf/types";
import type { SelectionSnapshot } from "./useSelectionSnapshot";

interface RdfPanelProps {
  app: Molvis | null;
  snapshot: SelectionSnapshot;
  computeAdapter?: RdfComputeAdapter;
}

type RunStatus = "idle" | "running" | "success" | "error";

const FALLBACK_ELEMENT = "C";

function nextDefaultParams(elements: string[]): RdfParams {
  const elementA = elements[0] ?? FALLBACK_ELEMENT;
  const elementB = elements[1] ?? elementA;
  return {
    pairType: "AA",
    elementA,
    elementB,
    rMax: 12.0,
    binWidth: 0.05,
    normalize: true,
    usePbc: true,
  };
}

function toNumberWithFallback(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

const RdfChart: React.FC<{ result: RdfResult }> = ({ result }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotlyRef = useRef<{
    react: (...args: unknown[]) => Promise<void> | void;
    purge: (element: HTMLElement) => void;
  } | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || result.r.length === 0 || result.g.length === 0) {
      return;
    }

    let disposed = false;

    const render = async () => {
      try {
        const loaded = await import("plotly.js-dist-min");
        const Plotly = (loaded as { default?: unknown }).default ?? loaded;
        const plotting = Plotly as {
          react: (...args: unknown[]) => Promise<void> | void;
          purge: (element: HTMLElement) => void;
        };

        if (disposed || !hostRef.current) {
          return;
        }

        plotlyRef.current = plotting;
        await plotting.react(
          hostRef.current,
          [
            {
              x: result.r,
              y: result.g,
              type: "scatter",
              mode: "lines",
              line: { width: 2, color: "#2563eb" },
              hovertemplate: "r=%{x:.3f}<br>g(r)=%{y:.3f}<extra></extra>",
            },
          ],
          {
            margin: { l: 38, r: 8, t: 8, b: 28 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            xaxis: {
              title: { text: "r" },
              showgrid: true,
              gridcolor: "rgba(127,127,127,0.18)",
              zeroline: false,
              tickfont: { size: 10 },
            },
            yaxis: {
              title: { text: "g(r)" },
              showgrid: true,
              gridcolor: "rgba(127,127,127,0.18)",
              zeroline: false,
              tickfont: { size: 10 },
            },
          },
          {
            displayModeBar: false,
            responsive: true,
          },
        );
        setChartError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to render Plotly chart";
        setChartError(message);
      }
    };

    render();

    return () => {
      disposed = true;
      if (hostRef.current && plotlyRef.current) {
        plotlyRef.current.purge(hostRef.current);
      }
    };
  }, [result]);

  if (result.r.length === 0 || result.g.length === 0) {
    return null;
  }

  return (
    <div className="rounded border bg-muted/10 p-1.5 space-y-1">
      <div ref={hostRef} className="h-[170px] w-full" />
      {chartError && (
        <div className="text-[10px] text-amber-600 inline-flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Plotly error: {chartError}
        </div>
      )}
    </div>
  );
};

export const RdfPanel: React.FC<RdfPanelProps> = ({
  app,
  snapshot,
  computeAdapter = syntheticRdfAdapter,
}) => {
  const [params, setParams] = useState<RdfParams>(() =>
    nextDefaultParams(snapshot.elements),
  );
  const [result, setResult] = useState<RdfResult | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [errorText, setErrorText] = useState<string>("");
  const [lastRunRevision, setLastRunRevision] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const elementOptions = useMemo(() => {
    if (snapshot.elements.length > 0) {
      return snapshot.elements;
    }
    return [FALLBACK_ELEMENT];
  }, [snapshot.elements]);

  const canRun =
    snapshot.atomCount > 0 && params.rMax > 0 && params.binWidth > 0;
  const stale =
    lastRunRevision !== null &&
    status === "success" &&
    lastRunRevision !== snapshot.revision;

  useEffect(() => {
    const available = new Set(elementOptions);
    setParams((prev) => {
      const nextA = available.has(prev.elementA)
        ? prev.elementA
        : (elementOptions[0] ?? FALLBACK_ELEMENT);
      const fallbackB = elementOptions[1] ?? nextA;
      const nextB =
        prev.elementB && available.has(prev.elementB)
          ? prev.elementB
          : fallbackB;

      if (nextA === prev.elementA && nextB === prev.elementB) {
        return prev;
      }

      return {
        ...prev,
        elementA: nextA,
        elementB: nextB,
      };
    });
  }, [elementOptions]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const emitStatus = (text: string, type: "info" | "error") => {
    app?.events.emit("status-message", { text, type });
  };

  const runRdf = async () => {
    if (!canRun) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("running");
    setErrorText("");

    try {
      const response = await computeAdapter.compute(
        params,
        {
          atomIds: snapshot.atomIds,
          atomCount: snapshot.atomCount,
          elements: snapshot.elements,
        },
        controller.signal,
      );

      setResult(response);
      setStatus("success");
      setLastRunRevision(snapshot.revision);
      emitStatus("RDF computation finished", "info");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown RDF error";
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setErrorText(message);
      emitStatus(`RDF error: ${message}`, "error");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const cancelRun = () => {
    abortRef.current?.abort();
    setStatus("idle");
    emitStatus("RDF computation canceled", "info");
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">Selection</span>
        <span>
          {snapshot.atomCount} atom{snapshot.atomCount !== 1 ? "s" : ""}
        </span>
        <span className="text-muted-foreground">Elements</span>
        <span className="truncate">
          {snapshot.elements.join(", ") || "None"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Pair Type</Label>
          <Select
            value={params.pairType}
            onValueChange={(value) =>
              setParams((prev) => ({ ...prev, pairType: value as "AA" | "AB" }))
            }
          >
            <SelectTrigger className="h-7 w-full text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AA" className="text-xs">
                A-A
              </SelectItem>
              <SelectItem value="AB" className="text-xs">
                A-B
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Element A</Label>
          <Select
            value={params.elementA}
            onValueChange={(value) =>
              setParams((prev) => ({ ...prev, elementA: value }))
            }
          >
            <SelectTrigger className="h-7 w-full text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elementOptions.map((el) => (
                <SelectItem key={el} value={el} className="text-xs">
                  {el}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {params.pairType === "AB" && (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Element B</Label>
          <Select
            value={params.elementB ?? params.elementA}
            onValueChange={(value) =>
              setParams((prev) => ({ ...prev, elementB: value }))
            }
          >
            <SelectTrigger className="h-7 w-full text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elementOptions.map((el) => (
                <SelectItem key={el} value={el} className="text-xs">
                  {el}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">rMax (A)</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            step="0.1"
            value={params.rMax}
            onChange={(event) =>
              setParams((prev) => ({
                ...prev,
                rMax: toNumberWithFallback(event.target.value, prev.rMax),
              }))
            }
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Bin Width</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            step="0.01"
            value={params.binWidth}
            onChange={(event) =>
              setParams((prev) => ({
                ...prev,
                binWidth: toNumberWithFallback(
                  event.target.value,
                  prev.binWidth,
                ),
              }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="h-7 px-2 rounded border bg-muted/10 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Normalize</span>
          <Switch
            className="scale-90"
            checked={params.normalize}
            onCheckedChange={(checked) =>
              setParams((prev) => ({ ...prev, normalize: checked }))
            }
          />
        </div>

        <div className="h-7 px-2 rounded border bg-muted/10 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">PBC</span>
          <Switch
            className="scale-90"
            checked={params.usePbc}
            onCheckedChange={(checked) =>
              setParams((prev) => ({ ...prev, usePbc: checked }))
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-[11px] px-2.5"
          disabled={!canRun || status === "running"}
          onClick={runRdf}
        >
          {status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
          Run RDF
        </Button>
        {status === "running" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] px-2"
            onClick={cancelRun}
          >
            Cancel
          </Button>
        )}
        {stale && (
          <span className="text-[10px] text-amber-600 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Selection changed
          </span>
        )}
      </div>

      <div className="rounded border bg-background/60 p-2 space-y-1.5">
        {status === "idle" && !result && (
          <div className="text-[11px] text-muted-foreground">
            Choose parameters and click{" "}
            <span className="font-medium">Run RDF</span>.
          </div>
        )}

        {status === "running" && (
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running RDF...
          </div>
        )}

        {status === "error" && (
          <div className="text-[11px] text-red-600 inline-flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 mt-[1px]" />
            <span>{errorText}</span>
          </div>
        )}

        {result && status !== "running" && (
          <>
            <RdfChart result={result} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                samples: {result.meta.sampleCount}
              </span>
              <span>peak r: {result.meta.peakR?.toFixed(2) ?? "-"}</span>
              <span>peak g: {result.meta.peakG?.toFixed(3) ?? "-"}</span>
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          "text-[10px] text-muted-foreground",
          stale && "text-amber-600",
        )}
      >
        Adapter:{" "}
        {computeAdapter === syntheticRdfAdapter
          ? "frontend synthetic placeholder"
          : "custom"}
      </div>
    </div>
  );
};
