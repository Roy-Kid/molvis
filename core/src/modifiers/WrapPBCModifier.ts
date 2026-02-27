import { Frame, WasmArray } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { logger } from "../utils/logger";

/**
 * WrapPBC modifier wraps atoms into the periodic box.
 * This is a selection-insensitive (global) operation.
 */
export class WrapPBCModifier extends BaseModifier {
  constructor(id: string) {
    super(id, "Wrap PBC", ModifierCategory.SelectionInsensitive);
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    const box = input.simbox;
    if (!box) {
      logger.warn("WrapPBC: Frame has no box, skipping");
      return input;
    }

    const atoms = input.getBlock("atoms");
    if (!atoms) {
      return input;
    }

    const x = atoms.getColumnF32("x");
    const y = atoms.getColumnF32("y");
    const z = atoms.getColumnF32("z");
    if (!x || !y || !z) {
      logger.warn("WrapPBC: missing x/y/z columns, skipping");
      return input;
    }

    const atomCount = atoms.nrows();
    if (atomCount === 0) {
      return input;
    }

    // Allocate WASM coord buffer directly to avoid an extra JS->WASM copy.
    const coordsView = new WasmArray(new Uint32Array([atomCount, 3]));
    const coords = coordsView.toTypedArray();
    for (let i = 0; i < atomCount; i++) {
      const i3 = i * 3;
      coords[i3] = x[i];
      coords[i3 + 1] = y[i];
      coords[i3 + 2] = z[i];
    }

    let wrappedView: WasmArray | null = null;
    try {
      wrappedView = box.wrap(coordsView);
      // Read wrapped coords via zero-copy view, then deinterleave once.
      const wrapped = wrappedView.toTypedArray();

      const wrappedX = new Float32Array(atomCount);
      const wrappedY = new Float32Array(atomCount);
      const wrappedZ = new Float32Array(atomCount);
      for (let i = 0; i < atomCount; i++) {
        const i3 = i * 3;
        wrappedX[i] = wrapped[i3];
        wrappedY[i] = wrapped[i3 + 1];
        wrappedZ[i] = wrapped[i3 + 2];
      }

      const result = new Frame();
      // Let WASM copy the full block once, then patch xyz columns.
      result.insertBlock("atoms", atoms);
      const resultAtoms = result.getBlock("atoms");
      if (!resultAtoms) {
        throw new Error("WrapPBC: failed to clone atoms block");
      }
      resultAtoms.setColumnF32("x", wrappedX);
      resultAtoms.setColumnF32("y", wrappedY);
      resultAtoms.setColumnF32("z", wrappedZ);

      const bonds = input.getBlock("bonds");
      if (bonds) {
        result.insertBlock("bonds", bonds);
      }

      result.simbox = box;
      return result;
    } finally {
      wrappedView?.free();
      coordsView.free();
    }
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}`;
  }
}
