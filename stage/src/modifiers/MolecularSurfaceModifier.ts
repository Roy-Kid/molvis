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
 * | `hull`     | convex envelope of the van der Waals spheres |
 * | `alpha`    | alpha shape: Delaunay tetrahedra smaller than α |
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
import { AlphaShape } from "../algo/surface/alpha_shape";
import { GridDomain } from "../algo/surface/grid_domain";
import { HullSurface } from "../algo/surface/hull_surface";
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
import { type ProjectParams, readEnum, readNumber } from "../project/params";
import { DType } from "../utils/dtype";
import { logger } from "../utils/logger";

export const SURFACE_ALGORITHMS = [
  "vdw",
  "sas",
  "ses",
  "gaussian",
  "hull",
  "alpha",
] as const;

export type SurfaceAlgorithm = (typeof SURFACE_ALGORITHMS)[number];

/** Algorithms that emit triangles directly, with no grid in between. */
export type MeshAlgorithm = "hull" | "alpha";

export function isMeshAlgorithm(
  algorithm: SurfaceAlgorithm,
): algorithm is MeshAlgorithm {
  return algorithm === "hull" || algorithm === "alpha";
}

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

export interface AlphaShapeParams {
  /** Probe sphere radius α, Å. Tetrahedra smaller than this are solid. */
  readonly probeRadius: number;
  /** Smoothing passes over the extracted surface. 0 leaves raw facets. */
  readonly smoothing: number;
}

/**
 * Delaunay runs on the main thread and costs about 2.8 s at this size on a
 * current laptop, rising steeply after; past it the freeze reads as a hang.
 * Measured on a uniform random cloud at protein density.
 */
export const MAX_ALPHA_SHAPE_ATOMS = 20_000;

export const DEFAULT_ALPHA_PARAMS: AlphaShapeParams = {
  probeRadius: 3,
  smoothing: 2,
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
  private _alpha: AlphaShapeParams = DEFAULT_ALPHA_PARAMS;
  private _style: IsosurfaceStyle = {
    ...DEFAULT_ISOSURFACE_STYLE,
    channel: "density",
    showNegative: false,
  };
  /** Gaussian only: pick the isovalue from the data until the user sets one. */
  private _isovalueAuto = true;
  private _lastReport: SurfaceReport | null = null;
  /** Cached so {@link onRemoved} can drop this modifier's meshes. */
  private _app: import("../app").MolvisApp | null = null;

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
  get alphaParams(): AlphaShapeParams {
    return this._alpha;
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

  setAlphaParams(patch: Partial<AlphaShapeParams>): void {
    this._alpha = { ...this._alpha, ...patch };
  }

  setStyle(patch: Partial<IsosurfaceStyle>): void {
    if (patch.isovalue !== undefined) this._isovalueAuto = false;
    this._style = { ...this._style, ...patch, channel: "density" };
  }

  /**
   * Persisted across project save/load and backend state-sync. Without this
   * the modifier would rebuild from the registry defaults, so a surface saved
   * as SES would reload as the default algorithm — see
   * {@link ../project/params}.
   */
  toProjectParams(): ProjectParams {
    return {
      algorithm: this._algorithm,
      solvent: { ...this._solvent },
      gaussian: { ...this._gaussian },
      alpha: { ...this._alpha },
      isovalue: this._isovalueAuto ? null : this._style.isovalue,
      opacity: this._style.opacity,
      color: [...this._style.color],
    };
  }

  fromProjectParams(params: ProjectParams): void {
    this._algorithm = readEnum(
      params.algorithm,
      SURFACE_ALGORITHMS,
      this._algorithm,
    );

    const solvent = asRecord(params.solvent);
    this._solvent = {
      resolution: readNumber(solvent.resolution, this._solvent.resolution),
      probeRadius: readNumber(solvent.probeRadius, this._solvent.probeRadius),
      radiusScale: readNumber(solvent.radiusScale, this._solvent.radiusScale),
    };

    const gaussian = asRecord(params.gaussian);
    this._gaussian = {
      resolution: readNumber(gaussian.resolution, this._gaussian.resolution),
      sigma: readNumber(gaussian.sigma, this._gaussian.sigma),
      cutoff:
        typeof gaussian.cutoff === "number" && Number.isFinite(gaussian.cutoff)
          ? gaussian.cutoff
          : null,
    };

    const alpha = asRecord(params.alpha);
    this._alpha = {
      probeRadius: readNumber(alpha.probeRadius, this._alpha.probeRadius),
      smoothing: readNumber(alpha.smoothing, this._alpha.smoothing),
    };

    // A null isovalue means it was never pinned, so auto-picking resumes.
    if (
      typeof params.isovalue === "number" &&
      Number.isFinite(params.isovalue)
    ) {
      this._isovalueAuto = false;
      this._style = { ...this._style, isovalue: params.isovalue };
    }
    this._style = {
      ...this._style,
      opacity: readNumber(params.opacity, this._style.opacity),
      color: readColor(params.color, this._style.color),
    };
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
    const params = this.paramsCacheKey(s.isovalue);
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

    this._app = ctx.app;
    const algorithm = this._algorithm;
    if (isMeshAlgorithm(algorithm)) {
      this.drawMeshAlgorithm(algorithm, atomInput, ctx);
      return input;
    }

    let drawFrame: Frame | null = null;
    try {
      const field =
        algorithm === "gaussian"
          ? this.buildGaussianField(atomInput)
          : this.buildSolventField(atomInput, algorithm);
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

      ctx.app.artist.drawIsosurface(this.id, drawFrame, {
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
    app.artist.surfaceLayer(this.id).setVisible(visible);
  }

  /**
   * Removal is not a visibility change: nothing calls `applyVisibility` for a
   * modifier that is gone, so the mesh has to be dropped here or it outlives
   * its owner.
   */
  onRemoved(): void {
    this._app?.artist.releaseSurfaceLayer(this.id);
    this._app = null;
  }

  private paramsCacheKey(isovalue: number): string {
    if (this._algorithm === "gaussian") {
      const g = this._gaussian;
      return `r=${g.resolution}:σ=${g.sigma}:c=${g.cutoff ?? "auto"}:iv=${isovalue}`;
    }
    if (this._algorithm === "alpha") {
      return `a=${this._alpha.probeRadius}:sm=${this._alpha.smoothing}`;
    }
    const v = this._solvent;
    return `r=${v.resolution}:p=${v.probeRadius}:s=${v.radiusScale}`;
  }

  private drawMeshAlgorithm(
    algorithm: MeshAlgorithm,
    atoms: AtomInput,
    ctx: PipelineContext,
  ): void {
    if (algorithm === "alpha") this.drawAlphaShape(atoms, ctx);
    else this.drawHull(atoms, ctx);
  }

  private drawAlphaShape(atoms: AtomInput, ctx: PipelineContext): void {
    if (atoms.count > MAX_ALPHA_SHAPE_ATOMS) {
      this._lastReport = {
        shape: null,
        spacing: null,
        resolutionClamped: false,
        usedFallbackRadius: false,
        degenerate: true,
        triangleCount: 0,
        tooManyAtoms: atoms.count,
      };
      logger.warn(
        `[Molecular surface] alpha shape needs a Delaunay tetrahedralisation; ${atoms.count} atoms exceeds the ${MAX_ALPHA_SHAPE_ATOMS} limit`,
      );
      ctx.app.artist.surfaceLayer(this.id).dispose();
      return;
    }

    const shape = new AlphaShape(atoms, {
      probeRadius: this._alpha.probeRadius,
      smoothing: this._alpha.smoothing,
    });
    this._lastReport = {
      shape: null,
      spacing: null,
      resolutionClamped: false,
      usedFallbackRadius: false,
      degenerate: shape.degenerate,
      triangleCount: shape.triangleCount,
      tooManyAtoms: null,
    };
    if (shape.degenerate) {
      logger.warn(
        "[Molecular surface] no tetrahedron survived the alpha filter; raise the probe radius",
      );
      ctx.app.artist.surfaceLayer(this.id).dispose();
      return;
    }
    ctx.app.artist.drawSurfaceMesh(this.id, shape.mesh, this._style);
  }

  private drawHull(atoms: AtomInput, ctx: PipelineContext): void {
    const hull = new HullSurface(atoms, {
      radiusScale: this._solvent.radiusScale,
    });
    this._lastReport = {
      shape: null,
      spacing: null,
      resolutionClamped: false,
      usedFallbackRadius: hull.usedFallbackRadius,
      degenerate: hull.degenerate,
      triangleCount: hull.mesh.indices.length / 3,
      tooManyAtoms: null,
    };
    if (hull.degenerate) {
      logger.warn(
        "[Molecular surface] atoms do not span a volume; convex hull has nothing to draw",
      );
      ctx.app.artist.surfaceLayer(this.id).dispose();
      return;
    }
    ctx.app.artist.drawSurfaceMesh(this.id, hull.mesh, this._style);
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
      degenerate: false,
      triangleCount: null,
      tooManyAtoms: null,
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
        degenerate: false,
        triangleCount: null,
        tooManyAtoms: null,
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
  /** Grid shape, or `null` for the algorithms that never build a grid. */
  shape: [number, number, number] | null;
  /** Voxel spacing in Å, or `null` when there is no grid. */
  spacing: number | null;
  resolutionClamped: boolean;
  usedFallbackRadius: boolean;
  /** True when the atoms could not span a volume, so nothing was drawn. */
  degenerate: boolean;
  /** Triangles drawn, for the algorithms that report a mesh directly. */
  triangleCount: number | null;
  /** Atom count when the run was refused for being too large; else null. */
  tooManyAtoms: number | null;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readColor(
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  const channels = value.map((c) =>
    typeof c === "number" && Number.isFinite(c)
      ? Math.max(0, Math.min(1, c))
      : null,
  );
  return channels.every((c) => c !== null)
    ? (channels as [number, number, number])
    : fallback;
}
