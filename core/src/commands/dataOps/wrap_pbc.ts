import { BaseDataOp } from "./base";
import type { DataOpContext } from "../types";
import type { Frame } from "../../structure/frame";
import type { Box } from "../../structure";

/**
 * Options for WrapPBCOp.
 */
export interface WrapPBCOptions {
  /** Box to use for wrapping (if not provided, uses frame.box) */
  box?: Box;
}

/**
 * WrapPBCOp wraps atom positions using periodic boundary conditions.
 * 
 * This operation wraps atom coordinates into the unit cell defined by the box.
 */
export class WrapPBCOp extends BaseDataOp {
  private options: WrapPBCOptions;

  constructor(options: WrapPBCOptions = {}, id?: string) {
    super(id);
    this.options = options;
  }

  apply(frame: Frame, _ctx: DataOpContext): Frame {
    const box = this.options.box || frame.box;
    if (!box) {
      // No box available, return frame unchanged
      return frame;
    }

    const atomBlock = frame.atomBlock;
    const nAtoms = atomBlock.n_atoms;
    const x = atomBlock.x;
    const y = atomBlock.y;
    const z = atomBlock.z;

    // Get box dimensions
    const lengths = box.lengths();
    const origin = box.origin;

    // Wrap coordinates into [0, lengths) range
    for (let i = 0; i < nAtoms; i++) {
      // Convert to fractional coordinates (simplified for orthogonal boxes)
      let fx = (x[i] - origin[0]) / lengths[0];
      let fy = (y[i] - origin[1]) / lengths[1];
      let fz = (z[i] - origin[2]) / lengths[2];

      // Wrap to [0, 1)
      fx = fx - Math.floor(fx);
      fy = fy - Math.floor(fy);
      fz = fz - Math.floor(fz);

      // Convert back to Cartesian
      x[i] = origin[0] + fx * lengths[0];
      y[i] = origin[1] + fy * lengths[1];
      z[i] = origin[2] + fz * lengths[2];
    }

    return frame;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: this.options,
    };
  }
}

