/**
 * Gaussian density surface — scene-changing Visualization modifier.
 *
 * Runs molrs `WasmGaussianDensity` on the current frame, packs the result
 * into an ephemeral grid Frame, and draws it via the shared isosurface
 * artist path (marching cubes). Does not mutate the pipeline frame.
 */

import {
  Box,
  type Frame,
  Frame as MolrsFrame,
  WasmGaussianDensity,
} from "@molcrafts/molvis-core/molrs";
import {
  DEFAULT_ISOSURFACE_STYLE,
  type IsosurfaceStyle,
} from "../artist/isosurface/isosurface_renderer";
import { logger } from "../utils/logger";
import { BaseModifier, ModifierCapability } from "./modifier";
import type { PipelineContext } from "./types";

interface Grid3Out {
  data: number[] | Float64Array;
  shape: [number, number, number] | number[];
}

function isGrid3Out(v: unknown): v is Grid3Out {
  if (!v || typeof v !== "object") return false;
  const o = v as Grid3Out;
  return (
    (Array.isArray(o.data) || ArrayBuffer.isView(o.data)) &&
    Array.isArray(o.shape) &&
    o.shape.length === 3
  );
}

export class GaussianDensitySurfaceModifier extends BaseModifier {
  static readonly NAME = "Gaussian density surface";

  private _nx = 32;
  private _ny = 32;
  private _nz = 32;
  private _sigma = 1.0;
  private _rMax: number | null = null;
  private _style: IsosurfaceStyle = {
    ...DEFAULT_ISOSURFACE_STYLE,
    channel: "density",
    showNegative: false,
  };
  private _isovalueAuto = true;

  constructor(id = "gaussian-density-surface") {
    super(
      id,
      GaussianDensitySurfaceModifier.NAME,
      new Set([ModifierCapability.Draws]),
    );
  }

  get nx(): number {
    return this._nx;
  }
  get ny(): number {
    return this._ny;
  }
  get nz(): number {
    return this._nz;
  }
  get sigma(): number {
    return this._sigma;
  }
  get rMax(): number | null {
    return this._rMax;
  }
  get style(): IsosurfaceStyle {
    return this._style;
  }

  setGrid(nx: number, ny: number, nz: number): void {
    this._nx = Math.max(2, Math.floor(nx));
    this._ny = Math.max(2, Math.floor(ny));
    this._nz = Math.max(2, Math.floor(nz));
  }

  setSigma(sigma: number): void {
    this._sigma = Math.max(1e-6, sigma);
  }

  setRMax(rMax: number | null): void {
    this._rMax = rMax !== null && rMax > 0 ? rMax : null;
  }

  setStyle(patch: Partial<IsosurfaceStyle>): void {
    if (patch.isovalue !== undefined) {
      this._isovalueAuto = false;
      patch = {
        ...patch,
        isovalue: Math.max(0, patch.isovalue),
      };
    }
    this._style = { ...this._style, ...patch, channel: "density" };
  }

  matches(frame: Frame): boolean {
    const atoms = frame.getBlock("atoms");
    return atoms !== undefined && atoms.nrows() > 0 && frame.box !== undefined;
  }

  isApplicable(frame: Frame): boolean {
    return this.matches(frame);
  }

  getCacheKey(): string {
    const s = this._style;
    return `${super.getCacheKey()}:g=${this._nx}x${this._ny}x${this._nz}:σ=${this._sigma}:r=${this._rMax ?? "auto"}:iv=${s.isovalue}:o=${s.opacity}:rgb=${s.color.join(",")}`;
  }

  apply(input: Frame, ctx: PipelineContext): Frame {
    if (!this.matches(input)) return input;

    let gd: WasmGaussianDensity | null = null;
    let ephemeral: Frame | null = null;
    try {
      gd = new WasmGaussianDensity(
        this._nx,
        this._ny,
        this._nz,
        this._sigma,
        this._rMax,
      );
      const raw = gd.compute(input);
      if (!isGrid3Out(raw)) {
        logger.warn(
          "[Gaussian density surface] unexpected compute payload; skip draw",
        );
        return input;
      }
      const [nx, ny, nz] = raw.shape;
      const data =
        raw.data instanceof Float64Array
          ? raw.data
          : Float64Array.from(raw.data);

      if (this._isovalueAuto) {
        let maxAbs = 0;
        for (let i = 0; i < data.length; i++) {
          const a = Math.abs(data[i]);
          if (a > maxAbs) maxAbs = a;
        }
        this._style = {
          ...this._style,
          isovalue: maxAbs > 0 ? maxAbs * 0.1 : 0.05,
        };
      }

      // Ephemeral frame: only box + grid density for the isosurface path.
      // Clone the simulation box so free() does not touch the pipeline frame.
      ephemeral = new MolrsFrame();
      const srcBox = input.box;
      if (srcBox) {
        const h = srcBox.hMatrix();
        const o = srcBox.origin();
        try {
          const cell = h.toCopy();
          const origin = o.toCopy();
          const pbc = srcBox.pbc();
          ephemeral.box = new Box(
            cell,
            origin,
            pbc[0] !== 0,
            pbc[1] !== 0,
            pbc[2] !== 0,
          );
        } finally {
          h.free();
          o.free();
        }
      }
      const grid = ephemeral.createBlock("grid");
      grid.setColF("density", data);
      grid.setShape(new Uint32Array([nx, ny, nz]));

      ctx.app.artist.drawIsosurface(ephemeral, this._style);
    } catch (err) {
      logger.warn(
        "[Gaussian density surface] compute/draw failed",
        err as Error,
      );
    } finally {
      gd?.free();
      ephemeral?.free();
    }
    return input;
  }

  applyVisibility(app: import("../app").MolvisApp, visible: boolean): void {
    app.artist.isosurfaceRenderer.setVisible(visible);
  }
}
