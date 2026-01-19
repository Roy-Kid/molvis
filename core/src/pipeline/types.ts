import type { Frame } from "../core/system/frame";

/**
 * Selection mask representing a subset of atoms/bonds.
 * Implemented as a boolean array where true = selected.
 */
export class SelectionMask {
    private mask: boolean[];

    constructor(size: number, initialValue: boolean = false) {
        this.mask = new Array(size).fill(initialValue);
    }

    /**
     * Create a mask with all atoms selected.
     */
    static all(size: number): SelectionMask {
        return new SelectionMask(size, true);
    }

    /**
     * Create a mask with no atoms selected.
     */
    static none(size: number): SelectionMask {
        return new SelectionMask(size, false);
    }

    /**
     * Create a mask from an array of indices.
     */
    static fromIndices(size: number, indices: number[]): SelectionMask {
        const mask = new SelectionMask(size, false);
        for (const idx of indices) {
            if (idx >= 0 && idx < size) {
                mask.mask[idx] = true;
            }
        }
        return mask;
    }

    /**
     * Get the size of the mask.
     */
    get size(): number {
        return this.mask.length;
    }

    /**
     * Check if an index is selected.
     */
    isSelected(index: number): boolean {
        return this.mask[index] ?? false;
    }

    /**
     * Set selection state for an index.
     */
    setSelected(index: number, selected: boolean): void {
        if (index >= 0 && index < this.mask.length) {
            this.mask[index] = selected;
        }
    }

    /**
     * Get count of selected atoms.
     */
    count(): number {
        return this.mask.filter(Boolean).length;
    }

    /**
     * Get array of selected indices.
     */
    getIndices(): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.mask.length; i++) {
            if (this.mask[i]) {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * Clone this mask.
     */
    clone(): SelectionMask {
        const cloned = new SelectionMask(this.mask.length);
        cloned.mask = [...this.mask];
        return cloned;
    }

    /**
     * Union with another mask (OR operation).
     */
    union(other: SelectionMask): SelectionMask {
        const size = Math.max(this.size, other.size);
        const result = new SelectionMask(size);
        for (let i = 0; i < size; i++) {
            result.mask[i] = this.isSelected(i) || other.isSelected(i);
        }
        return result;
    }

    /**
     * Intersection with another mask (AND operation).
     */
    intersection(other: SelectionMask): SelectionMask {
        const size = Math.min(this.size, other.size);
        const result = new SelectionMask(size);
        for (let i = 0; i < size; i++) {
            result.mask[i] = this.isSelected(i) && other.isSelected(i);
        }
        return result;
    }

    /**
     * Invert the mask (NOT operation).
     */
    invert(): SelectionMask {
        const result = new SelectionMask(this.size);
        for (let i = 0; i < this.size; i++) {
            result.mask[i] = !this.mask[i];
        }
        return result;
    }

    /**
     * Check if all atoms are selected.
     */
    isAll(): boolean {
        return this.mask.every(Boolean);
    }

    /**
     * Check if no atoms are selected.
     */
    isEmpty(): boolean {
        return this.mask.every(v => !v);
    }
}

/**
 * Pipeline execution context that flows through modifiers.
 */
export interface PipelineContext {
    /**
     * Named selections available for reference.
     */
    selectionSet: Map<string, SelectionMask>;

    /**
     * The current active selection used implicitly by selection-sensitive modifiers.
     */
    currentSelection: SelectionMask;

    /**
     * Frame index in trajectory (if applicable).
     */
    frameIndex?: number;
}

/**
 * Create a default pipeline context for a frame.
 */
export function createDefaultContext(frame: Frame, frameIndex?: number): PipelineContext {
    return {
        selectionSet: new Map(),
        currentSelection: SelectionMask.all(frame.getAtomCount()),
        frameIndex,
    };
}

/**
 * Push a new selection scope (for WithSelection blocks).
 */
export function pushSelectionScope(
    context: PipelineContext,
    newSelection: SelectionMask
): PipelineContext {
    return {
        ...context,
        currentSelection: newSelection,
    };
}

/**
 * Validation result from modifier.validate().
 */
export interface ValidationResult {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
}
