import { Frame, WasmArray } from "molrs-wasm";
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

    const x = atoms.viewColF32("x");
    const y = atoms.viewColF32("y");
    const z = atoms.viewColF32("z");
    if (!x || !y || !z) {
      logger.warn("WrapPBC: missing x/y/z columns, skipping");
      return input;
    }

    const atomCount = atoms.nrows();
    if (atomCount === 0) {
      return input;
    }

    // Build interleaved coords and write into WASM WasmArray.
    const interleaved = new Float32Array(atomCount * 3);
    for (let i = 0; i < atomCount; i++) {
      const i3 = i * 3;
      interleaved[i3] = x[i];
      interleaved[i3 + 1] = y[i];
      interleaved[i3 + 2] = z[i];
    }
    const coordsArr = WasmArray.from(
      interleaved,
      new Uint32Array([atomCount, 3]),
    );

    let wrappedArr: WasmArray | null = null;
    try {
      wrappedArr = box.wrap(coordsArr);
      const wrapped = wrappedArr.toCopy();

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
      result.insertBlock("atoms", atoms);
      const resultAtoms = result.getBlock("atoms");
      if (!resultAtoms) {
        throw new Error("WrapPBC: failed to clone atoms block");
      }
      resultAtoms.setColF32("x", wrappedX);
      resultAtoms.setColF32("y", wrappedY);
      resultAtoms.setColF32("z", wrappedZ);

      const bonds = input.getBlock("bonds");
      if (bonds) {
        result.insertBlock("bonds", bonds);
      }

      result.simbox = box;
      return result;
    } finally {
      wrappedArr?.free();
      coordsArr.free();
    }
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}`;
  }
}
