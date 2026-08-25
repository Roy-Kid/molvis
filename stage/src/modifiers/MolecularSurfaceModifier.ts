/**
 * Molecular surface — the envelope of a molecule, computed from its atoms.
 *
 * One modifier, several algorithms. The input contract is what defines the
 * modifier: **atoms in, surface out**. A step that needs a volumetric grid
 * from a CUBE/CHGCAR/XSF file is not this modifier — that is
 * {@link ../pipeline/draw_isosurface DrawIsosurfaceModifier}.
 *
 * | Algorithm  | Field                                       |
 * |------------|---------------------------------------------|
 * | `vdw`      | union of van der Waals balls                |
 * | `sas`      | solvent-accessible: balls grown by the probe|
 * | `ses`      | solvent-excluded (Connolly): probe rolled   |
 * | `gaussian` | molrs Gaussian density, meshed at an isovalue|
 *
 * Every algorithm produces a scalar field that is **positive inside**, so the
 * solvent modes mesh at 0 while `gaussian` meshes at its own isovalue.
 *
 * The field domain is the atom AABB + pad with `pbc = false`, never
 * `frame.box`: depositing on the crystal cell folds ASU atoms into the
 * primary cell while Particles still draw at deposited Cartn — the "surface
 * wrapped, protein not" bug. See `.claude/notes/open-questions.md`.
 *
 * Does not mutate the pipeline frame, and never auto-attaches: a surface is
 * opt-in Visualization.
 */

import {
  Box,
  type Frame,
  Frame as MolrsFrame,
  WasmGaussianDensity,
} from "@molcrafts/molvis-core/molrs";
import { GridDomain } from "../algo/surface/grid_domain";
import {
  SolventSurface,
  type SolventSurfaceMode,
} from "../algo/surface/solvent_surface";
import {
  DEFAULT_ISOSURFACE_STYLE,
  type IsosurfaceStyle,
} from "../artist/isosurface/isosurface_renderer";
import { viewAtomCoords } from "../io/atom_coords";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { DType } from "../utils/dtype";
import { logger } from "../utils/logger";

export type SurfaceAlgorithm = SolventSurfaceMode | "gaussian";

/** Shared by `vdw` / `sas` / `ses`; `vdw` ignores `probeRadius`. */
export interface SolventSurfaceParams {
  /** Voxel spacing, Å. */
  readonly resolution: number;
  /** Solvent probe radius, Å. 1.4 is water. */
  readonly probeRadius: number;
  /** Multiplier on tabulated van der Waals radii. */
  readonly radiusScale: number;
}

export interface GaussianSurfaceParams {
  /** Voxel spacing, Å. */
  readonly resolution: number;
  /** Gaussian kernel width, Å. */
  readonly sigma: number;
  /** Kernel truncation radius, Å. `null` lets molrs choose. */
  readonly cutoff: number | null;
}

export const DEFAULT_SOLVENT_PARAMS: SolventSurfaceParams = {
  resolution: 0.5,
  probeRadius: 1.4,
  radiusScale: 1,
};

export const DEFAULT_GAUSSIAN_PARAMS: GaussianSurfaceParams = {
  resolution: 0.5,
  sigma: 1,
  cutoff: null,
};

/** What a builder hands back for meshing. */
interface SurfaceField {
  origin: Float64Array;
  cell: Float64Array;
  shape: [number, number, number];
  values: Float64Array;
  isovalue: number;
}

interface AtomInput {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  count: number;
  elements?: string[];
}

export class MolecularSurfaceModifier extends BaseModifier {
  static readonly NAME = "Molecular surface";

  private _algorithm: SurfaceAlgorithm = "ses";
  private _solvent: SolventSurfaceParams = DEFAULT_SOLVENT_PARAMS;
  private _gaussian: GaussianSurfaceParams = DEFAULT_GAUSSIAN_PARAMS;
  private _style: IsosurfaceStyle = {
    ...DEFAULT_ISOSURFACE_STYLE,
    channel: "density",
    showNegative: false,
  };
  /** Gaussian only: pick the isovalue from the data until the user sets one. */
  private _isovalueAuto = true;
  private _lastReport: SurfaceReport | null = null;

  constructor(id = "molecular-surface") {
    super(
      id,
      MolecularSurfaceModifier.NAME,
      new Set([ModifierCapability.Draws]),
    );
  }

  get algorithm(): SurfaceAlgorithm {
    return this._algorithm;
  }
  get solventParams(): SolventSurfaceParams {
    return this._solvent;
  }
  get gaussianParams(): GaussianSurfaceParams {
    return this._gaussian;
  }
  get style(): IsosurfaceStyle {
    return this._style;
  }
  /** What the last run actually did — grid shape, clamping, radius fallback. */
  get report(): SurfaceReport | null {
    return this._lastReport;
  }

  /**
   * Switching algorithm keeps every algorithm's own parameters, so flipping
   * back and forth is lossless.
   */
  setAlgorithm(algorithm: SurfaceAlgorithm): void {
    this._algorithm = algorithm;
  }

  setSolventParams(patch: Partial<SolventSurfaceParams>): void {
    this._solvent = { ...this._solvent, ...patch };
  }

  setGaussianParams(patch: Partial<GaussianSurfaceParams>): void {
    this._gaussian = { ...this._gaussian, ...patch };
  }

  setStyle(patch: Partial<IsosurfaceStyle>): void {
    if (patch.isovalue !== undefined) this._isovalueAuto = false;
    this._style = { ...this._style, ...patch, channel: "density" };
  }

  /** Surfaces are opt-in Visualization, never a default layer. */
  matches(_frame: Frame): boolean {
    return false;
  }

  isApplicable(frame: Frame): boolean {
    const atoms = frame.getBlock("atoms");
    return atoms !== undefined && atoms.nrows() > 0;
  }

  getCacheKey(): string {
    const s = this._style;
    const params =
      this._algorithm === "gaussian"
        ? `r=${this._gaussian.resolution}:σ=${this._gaussian.sigma}:c=${this._gaussian.cutoff ?? "auto"}:iv=${s.isovalue}`
        : `r=${this._solvent.resolution}:p=${this._solvent.probeRadius}:s=${this._solvent.radiusScale}`;
    return `${super.getCacheKey()}:${this._algorithm}:${params}:o=${s.opacity}:rgb=${s.color.join(",")}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    const atoms = input.getBlock("atoms");
    if (!atoms || atoms.nrows() === 0) return input;

    const coords = viewAtomCoords(atoms);
    if (!coords) {
      logger.warn("[Molecular surface] frame has no x/y/z columns; skip draw");
      return input;
    }
    // Copy before any further WASM call: the coord views are zero-copy into
    // linear memory and a later call may grow (and detach) that buffer.
    const atomInput: AtomInput = {
      x: Float64Array.from(coords.x),
      y: Float64Array.from(coords.y),
      z: Float64Array.from(coords.z),
      count: atoms.nrows(),
      elements:
        atoms.dtype("element") === DType.String
          ? (atoms.copyColStr("element") as string[])
          : undefined,
    };

    let drawFrame: Frame | null = null;
    try {
      const field =
        this._algorithm === "gaussian"
          ? this.buildGaussianField(atomInput)
          : this.buildSolventField(atomInput, this._algorithm);
      if (!field) return input;

      drawFrame = new MolrsFrame();
      drawFrame.box = new Box(
        new Float64Array(field.cell),
        new Float64Array(field.origin),
        false,
        false,
        false,
      );
      const grid = drawFrame.createBlock("grid");
      grid.setColF("density", field.values);
      grid.setShape(new Uint32Array(field.shape));

      ctx.app.artist.drawIsosurface(drawFrame, {
        ...this._style,
        isovalue: field.isovalue,
      });
    } catch (err) {
      logger.warn("[Molecular surface] compute/draw failed", err as Error);
    } finally {
      drawFrame?.free();
    }
    return input;
  }

  applyVisibility(app: import("../app").MolvisApp, visible: boolean): void {
    app.artist.isosurfaceRenderer.setVisible(visible);
  }

  private buildSolventField(
    atoms: AtomInput,
    mode: SolventSurfaceMode,
  ): SurfaceField {
    const surface = new SolventSurface(atoms, {
      mode,
      resolution: this._solvent.resolution,
      probeRadius: this._solvent.probeRadius,
      radiusScale: this._solvent.radiusScale,
    });
    const { domain } = surface;
    this._lastReport = {
      shape: domain.shape,
      spacing: domain.spacing,
      resolutionClamped: surface.clamped,
      usedFallbackRadius: surface.usedFallbackRadius,
    };
    return {
      origin: domain.origin,
      cell: domain.cell,
      shape: domain.shape,
      values: surface.values,
      // The solvent envelopes are defined by their radii, not by a threshold.
      isovalue: 0,
    };
  }

  private buildGaussianField(atoms: AtomInput): SurfaceField | null {
    const { resolution, sigma, cutoff } = this._gaussian;
    const domain = new GridDomain(atoms.x, atoms.y, atoms.z, atoms.count, {
      pad: Math.max(3 * sigma, cutoff ?? 0, 1),
      spacing: resolution,
    });

    let density: WasmGaussianDensity | null = null;
    let computeFrame: Frame | null = null;
    try {
      // Same atom positions as Particles, on a non-periodic domain so the
      // kernel never folds contributions into the crystal cell.
      computeFrame = new MolrsFrame();
      computeFrame.box = new Box(
        new Float64Array(domain.cell),
        new Float64Array(domain.origin),
        false,
        false,
        false,
      );
      const block = computeFrame.createBlock("atoms");
      block.setColF("x", atoms.x);
      block.setColF("y", atoms.y);
      block.setColF("z", atoms.z);

      density = new WasmGaussianDensity(
        domain.nx,
        domain.ny,
        domain.nz,
        sigma,
        cutoff,
      );
      const raw = density.compute(computeFrame);
      const values = readGrid3(raw);
      if (!values) {
        logger.warn(
          "[Molecular surface] unexpected density payload; skip draw",
        );
        return null;
      }

      this._lastReport = {
        shape: domain.shape,
        spacing: domain.spacing,
        resolutionClamped: domain.clamped,
        usedFallbackRadius: false,
      };
      if (this._isovalueAuto) {
        this._style = { ...this._style, isovalue: autoIsovalue(values.data) };
      }
      return {
        origin: domain.origin,
        cell: domain.cell,
        shape: values.shape,
        values: values.data,
        isovalue: this._style.isovalue,
      };
    } finally {
      density?.free();
      computeFrame?.free();
    }
  }
}

/** What the last run did, for the panel's derived caption and alerts. */
export interface SurfaceReport {
  shape: [number, number, number];
  spacing: number;
  resolutionClamped: boolean;
  usedFallbackRadius: boolean;
}

interface Grid3 {
  data: Float64Array;
  shape: [number, number, number];
}

/** Validate the untyped `grid3` payload molrs returns from `compute()`. */
function readGrid3(raw: unknown): Grid3 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { data?: unknown; shape?: unknown };
  if (!Array.isArray(o.shape) || o.shape.length !== 3) return null;
  if (!Array.isArray(o.data) && !ArrayBuffer.isView(o.data)) return null;
  const data =
    o.data instanceof Float64Array
      ? o.data
      : Float64Array.from(o.data as ArrayLike<number>);
  return { data, shape: o.shape as [number, number, number] };
}

/** A tenth of the peak: dense enough to read as a molecule, not a blob. */
function autoIsovalue(data: Float64Array): number {
  let maxAbs = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > maxAbs) maxAbs = a;
  }
  return maxAbs > 0 ? maxAbs * 0.1 : 0.05;
}
