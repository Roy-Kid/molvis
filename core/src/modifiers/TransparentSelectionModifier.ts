import { Frame } from "molrs-wasm";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";

export const ALPHA_OVERRIDE = "__alpha";

/**
 * Modifier that applies a persistent alpha override to a specific set of atoms.
 * Multiple transparent modifiers can stack; later modifiers override earlier ones.
 */
export class TransparentSelectionModifier extends BaseModifier {
  private _indices: Set<number> = new Set();
  public opacity = 0.35;

  constructor(id = `transparent-selection-${Date.now()}`) {
    super(id, "Transparent", ModifierCategory.SelectionSensitive);
  }

  get selectedCount(): number {
    return this._indices.size;
  }

  setIndices(indices: Iterable<number>): boolean {
    const next = new Set<number>();
    for (const idx of indices) {
      if (Number.isInteger(idx) && idx >= 0) {
        next.add(idx);
      }
    }

    const changed =
      next.size !== this._indices.size ||
      [...next].some((idx) => !this._indices.has(idx));

    this._indices = next;
    return changed;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this.opacity}:${this._indices.size}`;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    if (this._indices.size === 0) return input;

    const atoms = input.getBlock("atoms");
    if (!atoms) return input;

    const atomCount = atoms.nrows();
    if (atomCount === 0) return input;

    const existingAlpha = atoms.dtype(ALPHA_OVERRIDE)
      ? atoms.viewColF32(ALPHA_OVERRIDE)
      : undefined;
    const alpha = existingAlpha
      ? new Float32Array(existingAlpha)
      : new Float32Array(atomCount).fill(Number.NaN);

    let changed = false;
    for (const idx of this._indices) {
      if (idx >= atomCount) continue;
      alpha[idx] = this.opacity;
      changed = true;
    }

    if (!changed) return input;

    const result = new Frame();
    result.insertBlock("atoms", atoms);
    const resultAtoms = result.getBlock("atoms");
    if (!resultAtoms) return input;

    resultAtoms.setColF32(ALPHA_OVERRIDE, alpha);

    const bonds = input.getBlock("bonds");
    if (bonds) result.insertBlock("bonds", bonds);

    const box = input.simbox;
    if (box) result.simbox = box;

    return result;
  }
}
