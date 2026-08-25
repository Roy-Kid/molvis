import {
  type MolecularSurfaceModifier as CoreMolecularSurfaceModifier,
  MAX_ALPHA_SHAPE_ATOMS,
  type Molvis,
  type SurfaceAlgorithm,
  type SurfaceReport,
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
import { hexToRgb, rgbToHex } from "./color_hex";
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
  { value: "alpha", label: "Alpha shape" },
];

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
  const isAlpha = algorithm === "alpha";
  const usesProbe = algorithm === "sas" || algorithm === "ses";
  // The hull is built from the spheres themselves; there is no grid to
  // resolve, so it has no resolution knob.
  const usesGrid = !isHull && !isAlpha;
  // Alpha shape works on atom centres — α is the scale knob, not radii.
  const usesRadii = !isGaussian && !isAlpha;
  const alpha = modifier.alphaParams;
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

          {usesRadii && (
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

          {isAlpha && (
            <>
              <ScalarSliderRow
                label="Probe radius (Å)"
                value={alpha.probeRadius}
                min={0.5}
                max={12}
                step={0.1}
                onPreview={(probeRadius) => {
                  modifier.setAlphaParams({ probeRadius });
                  onUpdate();
                }}
                onCommit={commit}
              />
              <ScalarSliderRow
                label="Smoothing"
                value={alpha.smoothing}
                min={0}
                max={10}
                step={1}
                format={(v) => v.toFixed(0)}
                onPreview={(smoothing) => {
                  modifier.setAlphaParams({ smoothing });
                  onUpdate();
                }}
                onCommit={commit}
              />
            </>
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
          {report?.tooManyAtoms ? (
            <p className="text-micro text-status-failed-foreground">
              {`Alpha shape is limited to ${MAX_ALPHA_SHAPE_ATOMS.toLocaleString()} atoms; this frame has ${report.tooManyAtoms.toLocaleString()}. Use a solvent surface instead.`}
            </p>
          ) : (
            report?.degenerate && (
              <p className="text-micro text-status-failed-foreground">
                {isAlpha
                  ? "No tetrahedron survived the probe radius — try a larger one"
                  : "These atoms do not span a volume — nothing to enclose"}
              </p>
            )
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
                modifier.setStyle({
                  color: hexToRgb(e.target.value, [0.4, 0.65, 1.0]),
                });
                commit();
              }}
            />
          </div>
        </>
      )}
    </fieldset>
  );
};
