
import { Frame, Block } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import { PipelineContext } from "../pipeline/types";

/**
 * Modifier that hides specific atoms based on a persistent selection.
 */
export class HideSelectionModifier extends BaseModifier {
    // Set of atom indices to hide
    private _hiddenIndices: Set<number> = new Set();

    constructor(id: string = "hide-selection-default") {
        super(id, "Hide Selection", ModifierCategory.SelectionSensitive);
    }

    get hiddenCount(): number {
        return this._hiddenIndices.size;
    }

    /**
     * Add indices to the hidden set
     */
    public hideIndices(indices: number[] | Iterable<number>) {
        let changed = false;
        for (const idx of indices) {
            if (!this._hiddenIndices.has(idx)) {
                this._hiddenIndices.add(idx);
                changed = true;
            }
        }
        return changed; // Return true if valid change
    }

    /**
     * Clear hidden set (Show all)
     */
    public showAll() {
        if (this._hiddenIndices.size > 0) {
            this._hiddenIndices.clear();
            return true;
        }
        return false;
    }

    getCacheKey(): string {
        return `${super.getCacheKey()}:${this._hiddenIndices.size}`;
    }

    apply(input: Frame, _context: PipelineContext): Frame {
        if (this._hiddenIndices.size === 0) return input;

        const atoms = input.getBlock("atoms");
        if (!atoms) return input;

        const nrows = atoms.nrows();
        // Check if we need to filter
        let needFilter = false;
        for (let i = 0; i < nrows; i++) {
            if (this._hiddenIndices.has(i)) {
                needFilter = true;
                break;
            }
        }
        if (!needFilter) return input;

        // -- Filter Atoms --
        // Mapping from old index to new index. -1 indicates hidden.
        const indexMap = new Int32Array(nrows);
        let newCount = 0;

        for (let i = 0; i < nrows; i++) {
            if (this._hiddenIndices.has(i)) {
                indexMap[i] = -1;
            } else {
                indexMap[i] = newCount++;
            }
        }

        if (newCount === 0) {
            return new Frame();
        }

        const newAtoms = new Block();

        // Helper to copy generic column
        const copyColF32 = (name: string) => {
            try {
                const src = atoms.getColumnF32(name);
                if (src) {
                    const dst = new Float32Array(newCount);
                    let ptr = 0;
                    for (let i = 0; i < nrows; i++) {
                        if (indexMap[i] !== -1) dst[ptr++] = src[i];
                    }
                    newAtoms.setColumnF32(name, dst);
                }
            } catch (e) {
                // Column likely doesn't exist
            }
        };

        const copyColStr = (name: string) => {
            try {
                const src = atoms.getColumnStrings(name);
                if (src) {
                    const dst: string[] = [];
                    for (let i = 0; i < nrows; i++) {
                        if (indexMap[i] !== -1) dst.push(src[i]);
                    }
                    newAtoms.setColumnStrings(name, dst);
                }
            } catch (e) {
                // Column likely doesn't exist
            }
        };

        copyColF32("x");
        copyColF32("y");
        copyColF32("z");
        copyColStr("element");

        // Optional columns
        copyColF32("vx");
        copyColF32("vy");
        copyColF32("vz");
        copyColF32("occupancy");
        copyColF32("tempFactor");
        copyColF32("charge");

        // -- Filter Bonds --
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
                    const oldI = iCol[b];
                    const oldJ = jCol[b];
                    if (indexMap[oldI] !== -1 && indexMap[oldJ] !== -1) {
                        validBonds.push(b);
                    }
                }

                if (validBonds.length > 0) {
                    newBonds = new Block();
                    const newNb = validBonds.length;
                    const newI = new Uint32Array(newNb);
                    const newJ = new Uint32Array(newNb);
                    const newOrder = new Uint8Array(newNb);

                    for (let k = 0; k < newNb; k++) {
                        const originalIdx = validBonds[k];
                        newI[k] = indexMap[iCol[originalIdx]];
                        newJ[k] = indexMap[jCol[originalIdx]];
                        if (orderCol) newOrder[k] = orderCol[originalIdx];
                        else newOrder[k] = 1;
                    }

                    newBonds.setColumnU32("i", newI);
                    newBonds.setColumnU32("j", newJ);
                    if (orderCol) newBonds.setColumnU8("order", newOrder);
                }
            }
        }

        const result = new Frame();
        result.insertBlock("atoms", newAtoms);
        if (newBonds) result.insertBlock("bonds", newBonds);

        return result;
    }

    validate(_input: Frame, _context: PipelineContext) {
        return { valid: true };
    }
}
