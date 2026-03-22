import { Frame } from "molrs-wasm";
import { hexToLinearRgb } from "../artist/palette";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import {
  COLOR_OVERRIDE_B,
  COLOR_OVERRIDE_G,
  COLOR_OVERRIDE_R,
} from "./ColorByPropertyModifier";

export interface ColorAssignment {
  /** Atom indices to color */
  indices: Set<number>;
  /** Hex color string, e.g. "#FF0000" */
  color: string;
}

/**
 * Modifier that assigns a uniform color to specific atoms.
 * Injects __color_r/g/b override columns (same as ColorByPropertyModifier).
 * Multiple color assignments can be stacked.
 */
export class AssignColorModifier extends BaseModifier {
  private _assignments: ColorAssignment[] = [];

  constructor(id = `assign-color-${Date.now()}`) {
    super(id, "Assign Color", ModifierCategory.SelectionSensitive);
  }

  get assignments(): readonly ColorAssignment[] {
    return this._assignments;
  }

  get selectedCount(): number {
    const indices = new Set<number>();
    for (const assignment of this._assignments) {
      for (const idx of assignment.indices) {
        indices.add(idx);
      }
    }
    return indices.size;
  }

  get primaryColor(): string {
    return this._assignments[0]?.color ?? "#FF4444";
  }

  /**
   * Add a color assignment for a set of atom indices.
   */
  addAssignment(indices: Iterable<number>, color: string): void {
    this._assignments.push({
      indices: new Set(indices),
      color,
    });
  }

  /**
   * Replace all assignments with a single captured selection.
   */
  setSelection(indices: Iterable<number>, color = this.primaryColor): void {
    this._assignments = [
      {
        indices: new Set(indices),
        color,
      },
    ];
  }

  /**
   * Update the primary color used by the first assignment.
   */
  setPrimaryColor(color: string): void {
    if (this._assignments.length === 0) {
      this._assignments.push({
        indices: new Set(),
        color,
      });
      return;
    }

    this._assignments[0].color = color;
  }

  /**
   * Clear all color assignments.
   */
  clearAssignments(): void {
    this._assignments = [];
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}:${this._assignments.length}:${this._assignments.map((a) => `${a.color}:${a.indices.size}`).join(",")}`;
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    if (this._assignments.length === 0) return input;

    const atoms = input.getBlock("atoms");
    if (!atoms) return input;

    const atomCount = atoms.nrows();
    if (atomCount === 0) return input;

    // Start from existing overrides or default (NaN = no override)
    const existingR = atoms.dtype(COLOR_OVERRIDE_R)
      ? atoms.viewColF32(COLOR_OVERRIDE_R)
      : undefined;
    const existingG = atoms.dtype(COLOR_OVERRIDE_G)
      ? atoms.viewColF32(COLOR_OVERRIDE_G)
      : undefined;
    const existingB = atoms.dtype(COLOR_OVERRIDE_B)
      ? atoms.viewColF32(COLOR_OVERRIDE_B)
      : undefined;

    const colorR = existingR
      ? new Float32Array(existingR)
      : new Float32Array(atomCount);
    const colorG = existingG
      ? new Float32Array(existingG)
      : new Float32Array(atomCount);
    const colorB = existingB
      ? new Float32Array(existingB)
      : new Float32Array(atomCount);

    let hasOverride = existingR !== undefined;

    // Apply each assignment (later assignments override earlier ones)
    for (const assignment of this._assignments) {
      const [r, g, b] = hexToLinearRgb(assignment.color);
      for (const idx of assignment.indices) {
        if (idx < atomCount) {
          colorR[idx] = r;
          colorG[idx] = g;
          colorB[idx] = b;
          hasOverride = true;
        }
      }
    }

    if (!hasOverride) return input;

    // Create new Frame with color override columns
    const result = new Frame();
    result.insertBlock("atoms", atoms);
    const resultAtoms = result.getBlock("atoms");
    if (!resultAtoms) return input;

    resultAtoms.setColF32(COLOR_OVERRIDE_R, colorR);
    resultAtoms.setColF32(COLOR_OVERRIDE_G, colorG);
    resultAtoms.setColF32(COLOR_OVERRIDE_B, colorB);

    // Copy bonds block if present
    const bonds = input.getBlock("bonds");
    if (bonds) result.insertBlock("bonds", bonds);

    // Preserve box
    const box = input.simbox;
    if (box) result.simbox = box;

    return result;
  }
}
