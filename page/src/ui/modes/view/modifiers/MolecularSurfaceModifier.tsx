import type {
  MolecularSurfaceModifier as CoreMolecularSurfaceModifier,
  Molvis,
  SurfaceAlgorithm,
  SurfaceReport,
} from "@molcrafts/molvis-stage";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplyPipelineOperation } from "@/hooks/useApplyPipelineOperation";
import type { ModifierPanelSurface } from "@/plugins/types";
import { ScalarSliderRow } from "./ScalarSliderRow";

interface Props {
  modifier: CoreMolecularSurfaceModifier;
  app: Molvis | null;
  onUpdate: () => void;
  surface?: ModifierPanelSurface;
}

const PIPELINE_COPY = {
  running: "Rebuilding surface…",
  success: "Surface updated",
  error: "Could not rebuild surface",
};

/**
 * Flat list — no family headers. Order runs cheapest-and-tightest to
 * loosest, which is also roughly how often each one is wanted.
 */
const ALGORITHMS: ReadonlyArray<{ value: SurfaceAlgorithm; label: string }> = [
  { value: "vdw", label: "Union of balls (vdW)" },
  { value: "sas", label: "Solvent-accessible (SAS)" },
  { value: "ses", label: "Solvent-excluded (SES)" },
  { value: "gaussian", label: "Gaussian density" },
  { value: "hull", label: "Convex hull" },
];

function rgbToHex(rgb: readonly [number, number, number]): string {
  const to8 = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${to8(rgb[0])}${to8(rgb[1])}${to8(rgb[2])}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.4, 0.65, 1.0];
  const n = Number.parseInt(m[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/**
 * One muted meta line: what the run actually built, never a locked input.
 * Field algorithms report their grid; mesh algorithms report their triangles.
 */
function describeRun(report: SurfaceReport): string | null {
  if (report.shape && report.spacing !== null) {
    const [nx, ny, nz] = report.shape;
    const voxels = nx * ny * nz;
    const count =
      voxels >= 1e6
        ? `${(voxels / 1e6).toFixed(1)}M`
        : `${Math.round(voxels / 1000)}k`;
    return `grid ${nx}×${ny}×${nz} · ${report.spacing.toFixed(2)} Å · ${count} voxels`;
  }
  if (report.triangleCount) {
    return `${report.triangleCount.toLocaleString()} triangles`;
  }
  return null;
}

export const MolecularSurfaceModifier: React.FC<Props> = ({
  modifier,
  app,
  onUpdate,
  surface = "full",
}) => {
  const { applyPipeline, pipelineRunning } = useApplyPipelineOperation(
    app,
    onUpdate,
    PIPELINE_COPY,
  );
  const style = modifier.style;
  const algorithm = modifier.algorithm;
  const report = modifier.report;
  const showCompute = surface === "full" || surface === "compute";
  const showDraw = surface === "full" || surface === "draw";

  const isGaussian = algorithm === "gaussian";
  const isHull = algorithm === "hull";
  const usesProbe = algorithm === "sas" || algorithm === "ses";
  // The hull is built from the spheres themselves; there is no grid to
  // resolve, so it has no resolution knob.
  const usesGrid = !isHull;
  const solvent = modifier.solventParams;
  const gaussian = modifier.gaussianParams;
  const resolution = isGaussian ? gaussian.resolution : solvent.resolution;

  const commit = () => {
    void applyPipeline();
  };

  const setResolution = (value: number) => {
    if (isGaussian) modifier.setGaussianParams({ resolution: value });
    else modifier.setSolventParams({ resolution: value });
    onUpdate();
  };

  return (
    <fieldset
      disabled={!app || pipelineRunning}
      aria-busy={pipelineRunning}
      className="m-0 min-w-0 space-y-3 border-0 p-0"
    >
      {showCompute && (
        <>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Algorithm</Label>
            <Select
              value={algorithm}
              onValueChange={(v) => {
                modifier.setAlgorithm(v as SurfaceAlgorithm);
                commit();
              }}
            >
              <SelectTrigger
                aria-label="Surface algorithm"
                className="h-control-compact text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALGORITHMS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {usesGrid && (
            <ScalarSliderRow
              label="Resolution (Å)"
              value={resolution}
              min={0.1}
              max={2}
              step={0.05}
              onPreview={setResolution}
              onCommit={commit}
            />
          )}

          {usesProbe && (
            <ScalarSliderRow
              label="Probe radius (Å)"
              value={solvent.probeRadius}
              min={0}
              max={5}
              step={0.05}
              onPreview={(probeRadius) => {
                modifier.setSolventParams({ probeRadius });
                onUpdate();
              }}
              onCommit={commit}
            />
          )}

          {!isGaussian && (
            <ScalarSliderRow
              label="Radius scale"
              value={solvent.radiusScale}
              min={0.2}
              max={2}
              step={0.05}
              onPreview={(radiusScale) => {
                modifier.setSolventParams({ radiusScale });
                onUpdate();
              }}
              onCommit={commit}
            />
          )}

          {isGaussian && (
            <>
              <ScalarSliderRow
                label="Sigma (Å)"
                value={gaussian.sigma}
                min={0.1}
                max={5}
                step={0.05}
                onPreview={(sigma) => {
                  modifier.setGaussianParams({ sigma });
                  onUpdate();
                }}
                onCommit={commit}
              />
              <div className="space-y-1">
                <Label className="text-xs font-semibold" htmlFor="ms-cutoff">
                  Cutoff (Å)
                </Label>
                <Input
                  id="ms-cutoff"
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder="Auto"
                  value={gaussian.cutoff ?? ""}
                  className="h-control-compact px-2 text-xs"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const n = Number(raw);
                    modifier.setGaussianParams({
                      cutoff: raw === "" || !Number.isFinite(n) ? null : n,
                    });
                    onUpdate();
                  }}
                  onBlur={commit}
                />
              </div>
            </>
          )}

          {report && describeRun(report) && (
            <p className="text-micro text-muted-foreground font-mono tabular-nums">
              {describeRun(report)}
            </p>
          )}
          {report?.resolutionClamped && (
            <p className="text-micro text-status-failed-foreground">
              Resolution coarsened to stay within the voxel limit
            </p>
          )}
          {report?.degenerate && (
            <p className="text-micro text-status-failed-foreground">
              These atoms do not span a volume — nothing to enclose
            </p>
          )}
          {report?.usedFallbackRadius && !isGaussian && (
            <p className="text-micro text-status-failed-foreground">
              No element column — using a uniform radius
            </p>
          )}
        </>
      )}

      {showDraw && (
        <>
          {/* The solvent envelopes are defined by their radii; only the
              density surface has a threshold worth exposing. */}
          {isGaussian && (
            <ScalarSliderRow
              label="Isovalue"
              value={style.isovalue}
              min={0}
              max={Math.max(style.isovalue * 2, 1)}
              step={Math.max(style.isovalue / 50, 0.001)}
              onPreview={(isovalue) => {
                modifier.setStyle({ isovalue });
                onUpdate();
              }}
              onCommit={commit}
            />
          )}

          <ScalarSliderRow
            label="Opacity"
            value={style.opacity}
            min={0}
            max={1}
            step={0.05}
            onPreview={(opacity) => {
              modifier.setStyle({ opacity });
              onUpdate();
            }}
            onCommit={commit}
          />

          <div className="space-y-1.5">
            <Label className="text-micro" htmlFor="ms-color">
              Color
            </Label>
            <Input
              id="ms-color"
              type="color"
              value={rgbToHex(style.color)}
              className="h-8 w-full p-1"
              onChange={(e) => {
                modifier.setStyle({ color: hexToRgb(e.target.value) });
                commit();
              }}
            />
          </div>
        </>
      )}
    </fieldset>
  );
};
