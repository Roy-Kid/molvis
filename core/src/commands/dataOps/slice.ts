import { BaseDataOp } from "./base";
import type { DataOpContext } from "../types";
import type { Frame } from "../../structure/frame";
import { AtomBlock, BondBlock } from "../../structure";

/**
 * Options for SliceOp.
 */
export interface SliceOptions {
  /** Indices of atoms to keep (0-based) */
  indices: number[];
}

/**
 * SliceOp extracts a subset of atoms from a frame.
 * 
 * This operation creates a new frame containing only the specified atoms
 * and their associated bonds (if bonds exist).
 */
export class SliceOp extends BaseDataOp {
  private options: SliceOptions;

  constructor(options: SliceOptions, id?: string) {
    super(id);
    this.options = options;
  }

  apply(frame: Frame, _ctx: DataOpContext): Frame {
    const indices = this.options.indices;
    const atomBlock = frame.atomBlock;
    const nAtoms = atomBlock.n_atoms;

    // Validate indices
    const validIndices = indices.filter(idx => idx >= 0 && idx < nAtoms);
    if (validIndices.length === 0) {
      throw new Error("SliceOp: No valid atom indices provided");
    }

    // Create index map for quick lookup
    const indexSet = new Set(validIndices);
    const indexMap = new Map<number, number>(); // old index -> new index
    validIndices.forEach((oldIdx, newIdx) => {
      indexMap.set(oldIdx, newIdx);
    });

    // Create new atom block
    const newNAtoms = validIndices.length;
    const newX = new Float32Array(newNAtoms);
    const newY = new Float32Array(newNAtoms);
    const newZ = new Float32Array(newNAtoms);
    const newElements = new Uint8Array(newNAtoms);
    const newCharges = new Float32Array(newNAtoms);

    validIndices.forEach((oldIdx, newIdx) => {
      newX[newIdx] = atomBlock.x[oldIdx];
      newY[newIdx] = atomBlock.y[oldIdx];
      newZ[newIdx] = atomBlock.z[oldIdx];
      newElements[newIdx] = atomBlock.elements[oldIdx];
      if (atomBlock.charges) {
        newCharges[newIdx] = atomBlock.charges[oldIdx];
      }
    });

    const newAtomBlock = new AtomBlock(
      newX,
      newY,
      newZ,
      newElements,
      newCharges.length > 0 ? newCharges : undefined
    );

    // Create new bond block if bonds exist
    let newBondBlock: BondBlock | undefined;
    if (frame.bondBlock && frame.bondBlock.n_bonds > 0) {
      const bondBlock = frame.bondBlock;
      const validBonds: { i: number; j: number }[] = [];

      for (let b = 0; b < bondBlock.n_bonds; b++) {
        const i = bondBlock.i[b];
        const j = bondBlock.j[b];
        if (indexSet.has(i) && indexSet.has(j)) {
          validBonds.push({
            i: indexMap.get(i)!,
            j: indexMap.get(j)!,
          });
        }
      }

      if (validBonds.length > 0) {
        const newI = new Uint32Array(validBonds.length);
        const newJ = new Uint32Array(validBonds.length);
        validBonds.forEach((bond, idx) => {
          newI[idx] = bond.i;
          newJ[idx] = bond.j;
        });
        newBondBlock = new BondBlock(newI, newJ);
      }
    }

    // Create new frame with sliced data
    const newFrame = new Frame(newAtomBlock, newBondBlock);
    newFrame.box = frame.box; // Copy box reference
    newFrame.meta = new Map(frame.meta); // Copy metadata

    return newFrame;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: this.options,
    };
  }
}

