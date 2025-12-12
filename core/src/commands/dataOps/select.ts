import { BaseDataOp } from "./base";
import type { DataOpContext } from "../types";
import type { Frame } from "../../structure/frame";

/**
 * Options for SelectByPropertyOp.
 */
export interface SelectByPropertyOptions {
  /** Property name to select by (e.g., "element", "charge") */
  property: string;
  /** Value or values to match */
  value: number | string | (number | string)[];
  /** Selection name to store in frame.meta (default: "selection") */
  selectionName?: string;
}

/**
 * SelectByPropertyOp creates a selection mask based on atom properties.
 * 
 * The selection is stored in frame.meta as a boolean array indicating
 * which atoms match the selection criteria.
 */
export class SelectByPropertyOp extends BaseDataOp {
  private options: SelectByPropertyOptions;

  constructor(options: SelectByPropertyOptions, id?: string) {
    super(id);
    this.options = options;
  }

  apply(frame: Frame, _ctx: DataOpContext): Frame {
    const atomBlock = frame.atomBlock;
    const nAtoms = atomBlock.n_atoms;
    const property = this.options.property;
    const value = this.options.value;
    const selectionName = this.options.selectionName || "selection";

    // Create selection mask
    const mask = new Array<boolean>(nAtoms);
    const values = Array.isArray(value) ? value : [value];

    for (let i = 0; i < nAtoms; i++) {
      let atomValue: number | string | undefined;

      // Get property value based on property name
      switch (property) {
        case "element":
          atomValue = atomBlock.elements[i];
          break;
        case "charge":
          atomValue = atomBlock.charges ? atomBlock.charges[i] : undefined;
          break;
        default:
          // Try to get from metadata
          const metaKey = `atom_${property}_${i}`;
          atomValue = frame.meta.get(metaKey) as number | string | undefined;
      }

      // Check if atom value matches any of the target values
      mask[i] = atomValue !== undefined && values.some(v => {
        if (typeof atomValue === "number" && typeof v === "number") {
          return Math.abs(atomValue - v) < 1e-6;
        }
        return atomValue === v;
      });
    }

    // Store selection in frame metadata
    frame.meta.set(selectionName, mask);

    return frame;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      options: this.options,
    };
  }
}

