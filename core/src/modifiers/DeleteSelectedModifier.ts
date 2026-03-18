import { Block, Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";

/**
 * Modifier that removes specific atoms from the pipeline output.
 * Similar to HideSelectionModifier but performs actual removal (filtering)
 * rather than visual hiding. Remaps bond indices after atom removal.
 */
export class DeleteSelectedModifier extends BaseModifier {
  private _deletedIndices: Set<number> = new Set();

  constructor(id = `delete-selected-${Date.now()}`) {
    super(id, "Delete Selected", ModifierCategory.SelectionSensitive);
  }

  get deletedCount(): number {
    return this._deletedIndices.size;
  }

  /**
   * Mark atom indices for deletion.
   */
  deleteIndices(indices: Iterable<number>): boolean {
    let changed = false;
    for (const idx of indices) {
      if (!this._deletedIndices.has(idx)) {
        this._deletedIndices.add(idx);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Restore all deleted atoms.
   */
  restoreAll(): boolean {
    if (this._deletedIndices.size > 0) {
      this._deletedIndices.clear();
      return true;
    }
    return false;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this._deletedIndices.size}`;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    if (this._deletedIndices.size === 0) return input;

    const atoms = input.getBlock("atoms");
    if (!atoms) return input;

    const nrows = atoms.nrows();
    let needFilter = false;
    for (let i = 0; i < nrows; i++) {
      if (this._deletedIndices.has(i)) {
        needFilter = true;
        break;
      }
    }
    if (!needFilter) return input;

    // Build index map: old → new (-1 = deleted)
    const indexMap = new Int32Array(nrows);
    let newCount = 0;
    for (let i = 0; i < nrows; i++) {
      if (this._deletedIndices.has(i)) {
        indexMap[i] = -1;
      } else {
        indexMap[i] = newCount++;
      }
    }

    if (newCount === 0) return new Frame();

    // Filter atoms
    const newAtoms = new Block();
    for (const key of atoms.keys()) {
      const dtype = atoms.getDtype(key);
      if (dtype === "str" || dtype === "string") {
        const src = atoms.getColumnStrings(key);
        if (src) {
          const dst: string[] = [];
          for (let i = 0; i < nrows; i++) {
            if (indexMap[i] !== -1) dst.push(src[i]);
          }
          newAtoms.setColumnStrings(key, dst);
        }
      } else {
        const src = atoms.getColumnF32(key);
        if (src) {
          const dst = new Float32Array(newCount);
          let ptr = 0;
          for (let i = 0; i < nrows; i++) {
            if (indexMap[i] !== -1) dst[ptr++] = src[i];
          }
          newAtoms.setColumnF32(key, dst);
        }
      }
    }

    // Filter bonds
    const bonds = input.getBlock("bonds");
    let newBonds: Block | undefined;

    if (bonds) {
      const iCol = bonds.getColumnU32("i");
      const jCol = bonds.getColumnU32("j");
      const orderCol = bonds.getColumnU8("order");

      if (iCol && jCol) {
        const bondCount = bonds.nrows();
        const validBonds: number[] = [];

        for (let b = 0; b < bondCount; b++) {
          if (indexMap[iCol[b]] !== -1 && indexMap[jCol[b]] !== -1) {
            validBonds.push(b);
          }
        }

        if (validBonds.length > 0) {
          newBonds = new Block();
          const nb = validBonds.length;
          const newI = new Uint32Array(nb);
          const newJ = new Uint32Array(nb);

          for (let k = 0; k < nb; k++) {
            const orig = validBonds[k];
            newI[k] = indexMap[iCol[orig]];
            newJ[k] = indexMap[jCol[orig]];
          }

          newBonds.setColumnU32("i", newI);
          newBonds.setColumnU32("j", newJ);
          if (orderCol) {
            const newOrder = new Uint8Array(nb);
            for (let k = 0; k < nb; k++) {
              newOrder[k] = orderCol[validBonds[k]];
            }
            newBonds.setColumnU8("order", newOrder);
          }
        }
      }
    }

    const result = new Frame();
    result.insertBlock("atoms", newAtoms);
    if (newBonds) result.insertBlock("bonds", newBonds);

    const box = input.simbox;
    if (box) result.simbox = box;

    return result;
  }
}
