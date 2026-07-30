/**
 * OVITO-style **Unwrap trajectories**: remove PBC jumps by accumulating
 * minimum-image displacements between successive pipeline frames.
 *
 * State is kept on the modifier instance across `apply` calls. Scrubbing
 * backward (frameIndex ≤ last) re-seeds from the current frame.
 */

import { type Box, Frame, WasmArray } from "@molcrafts/molvis-core/molrs";
import { viewAtomCoords } from "../io/atom_coords";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { logger } from "../utils/logger";

export class UnwrapTrajectoriesModifier extends BaseModifier {
  static readonly NAME = "Unwrap trajectories";

  private _moleculeAware = true;
  private _lastFrameIndex = -1;
  private _prevWrappedX: Float64Array | null = null;
  private _prevWrappedY: Float64Array | null = null;
  private _prevWrappedZ: Float64Array | null = null;
  private _unwrappedX: Float64Array | null = null;
  private _unwrappedY: Float64Array | null = null;
  private _unwrappedZ: Float64Array | null = null;

  constructor(id = "unwrap-trajectories-default") {
    super(
      id,
      UnwrapTrajectoriesModifier.NAME,
      new Set([ModifierCapability.TransformsData]),
    );
  }

  get moleculeAware(): boolean {
    return this._moleculeAware;
  }

  setMoleculeAware(v: boolean): void {
    this._moleculeAware = v;
  }

  /** Reset unwrap state (e.g. after disable). */
  resetState(): void {
    this._lastFrameIndex = -1;
    this._prevWrappedX = null;
    this._prevWrappedY = null;
    this._prevWrappedZ = null;
    this._unwrappedX = null;
    this._unwrappedY = null;
    this._unwrappedZ = null;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this._moleculeAware}:${this._lastFrameIndex}`;
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const box = input.box;
    if (!box) {
      logger.warn("Unwrap trajectories: no box, skipping");
      return input;
    }
    const atoms = input.getBlock("atoms");
    if (!atoms) return input;
    const coords = viewAtomCoords(atoms);
    if (!coords?.x || !coords.y || !coords.z) {
      logger.warn("Unwrap trajectories: missing coordinates, skipping");
      return input;
    }

    const n = atoms.nrows();
    const frameIndex = context.frameIndex ?? 0;
    const wx = coords.x;
    const wy = coords.y;
    const wz = coords.z;

    const needSeed =
      this._unwrappedX === null ||
      this._unwrappedX.length !== n ||
      frameIndex <= this._lastFrameIndex ||
      this._prevWrappedX === null;

    let ux: Float64Array;
    let uy: Float64Array;
    let uz: Float64Array;

    if (needSeed) {
      ux = new Float64Array(wx);
      uy = new Float64Array(wy);
      uz = new Float64Array(wz);
    } else {
      const px = this._prevWrappedX as Float64Array;
      const py = this._prevWrappedY as Float64Array;
      const pz = this._prevWrappedZ as Float64Array;
      const prevU = this._unwrappedX as Float64Array;
      const prevUy = this._unwrappedY as Float64Array;
      const prevUz = this._unwrappedZ as Float64Array;
      const d = micDisplacements(box, px, py, pz, wx, wy, wz, n);
      ux = new Float64Array(n);
      uy = new Float64Array(n);
      uz = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        ux[i] = prevU[i] + d.dx[i];
        uy[i] = prevUy[i] + d.dy[i];
        uz[i] = prevUz[i] + d.dz[i];
      }
      // moleculeAware: currently same per-atom MIC path; reserved for
      // shared-image correction across bonded components (future).
      void this._moleculeAware;
    }

    this._prevWrappedX = new Float64Array(wx);
    this._prevWrappedY = new Float64Array(wy);
    this._prevWrappedZ = new Float64Array(wz);
    this._unwrappedX = ux;
    this._unwrappedY = uy;
    this._unwrappedZ = uz;
    this._lastFrameIndex = frameIndex;

    const result = new Frame();
    result.insertBlock("atoms", atoms);
    const outAtoms = result.getBlock("atoms");
    if (!outAtoms) return input;
    outAtoms.setColF(coords.columns.x, ux);
    outAtoms.setColF(coords.columns.y, uy);
    outAtoms.setColF(coords.columns.z, uz);

    const bonds = input.getBlock("bonds");
    if (bonds) result.insertBlock("bonds", bonds);
    for (const name of input.blockNames()) {
      if (name === "atoms" || name === "bonds") continue;
      const block = input.getBlock(name);
      if (block) result.insertBlock(name, block);
    }
    result.box = box;
    return result;
  }
}

function micDisplacements(
  box: Box,
  ax: Float64Array,
  ay: Float64Array,
  az: Float64Array,
  bx: Float64Array,
  by: Float64Array,
  bz: Float64Array,
  n: number,
): { dx: Float64Array; dy: Float64Array; dz: Float64Array } {
  const a = new Float64Array(n * 3);
  const b = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    a[i3] = ax[i];
    a[i3 + 1] = ay[i];
    a[i3 + 2] = az[i];
    b[i3] = bx[i];
    b[i3 + 1] = by[i];
    b[i3 + 2] = bz[i];
  }
  const aArr = WasmArray.from(a, new Uint32Array([n, 3]));
  const bArr = WasmArray.from(b, new Uint32Array([n, 3]));
  try {
    const delta = box.delta(aArr, bArr, true);
    try {
      const d = delta.toCopy();
      const dx = new Float64Array(n);
      const dy = new Float64Array(n);
      const dz = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        dx[i] = d[i3];
        dy[i] = d[i3 + 1];
        dz[i] = d[i3 + 2];
      }
      return { dx, dy, dz };
    } finally {
      delta.free();
    }
  } finally {
    aArr.free();
    bArr.free();
  }
}
