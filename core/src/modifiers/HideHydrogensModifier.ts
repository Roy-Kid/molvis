import { Block, Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";

/**
 * Modifier that hides hydrogen atoms from the scene.
 * Filters atoms where element === "H" and remaps bond indices.
 */
export class HideHydrogensModifier extends BaseModifier {
  private _hideHydrogens = false;

  constructor(id = "hide-hydrogens-default") {
    super(id, "Hide Hydrogens", ModifierCategory.SelectionInsensitive);
  }

  get hideHydrogens(): boolean {
    return this._hideHydrogens;
  }

  set hideHydrogens(value: boolean) {
    this._hideHydrogens = value;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this._hideHydrogens}`;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    if (!this._hideHydrogens) return input;

    const atoms = input.getBlock("atoms");
    if (!atoms) return input;

    const elements = atoms.getColumnStrings("element");
    if (!elements) return input;

    const nrows = atoms.nrows();
    const indexMap = new Int32Array(nrows);
    let newCount = 0;

    for (let i = 0; i < nrows; i++) {
      if (elements[i] === "H") {
        indexMap[i] = -1;
      } else {
        indexMap[i] = newCount++;
      }
    }

    // If no hydrogens found, pass through
    if (newCount === nrows) return input;
    if (newCount === 0) return new Frame();

    // Filter atoms
    const newAtoms = new Block();
    copyFilteredColumnF32(atoms, newAtoms, "x", indexMap, nrows, newCount);
    copyFilteredColumnF32(atoms, newAtoms, "y", indexMap, nrows, newCount);
    copyFilteredColumnF32(atoms, newAtoms, "z", indexMap, nrows, newCount);
    copyFilteredColumnStr(atoms, newAtoms, "element", indexMap, nrows);

    // Optional columns
    for (const col of ["vx", "vy", "vz", "occupancy", "tempFactor", "charge"]) {
      copyFilteredColumnF32(atoms, newAtoms, col, indexMap, nrows, newCount);
    }
    for (const col of ["type", "species"]) {
      copyFilteredColumnStr(atoms, newAtoms, col, indexMap, nrows);
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

    // Preserve box
    const box = input.simbox;
    if (box) result.simbox = box;

    return result;
  }
}

function copyFilteredColumnF32(
  src: Block,
  dst: Block,
  name: string,
  indexMap: Int32Array,
  nrows: number,
  newCount: number,
): void {
  const col = src.getColumnF32(name);
  if (!col) return;
  const out = new Float32Array(newCount);
  let ptr = 0;
  for (let i = 0; i < nrows; i++) {
    if (indexMap[i] !== -1) out[ptr++] = col[i];
  }
  dst.setColumnF32(name, out);
}

function copyFilteredColumnStr(
  src: Block,
  dst: Block,
  name: string,
  indexMap: Int32Array,
  nrows: number,
): void {
  const col = src.getColumnStrings(name);
  if (!col) return;
  const out: string[] = [];
  for (let i = 0; i < nrows; i++) {
    if (indexMap[i] !== -1) out.push(col[i]);
  }
  dst.setColumnStrings(name, out);
}
