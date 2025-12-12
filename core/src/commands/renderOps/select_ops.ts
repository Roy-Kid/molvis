import { BaseRenderOp } from "./base";
import { SelectionManager } from "../../core/selection_manager";
import type { RenderOpContext } from "../types";
import type { Scene, AbstractMesh } from "@babylonjs/core";
import type { Frame } from "../../structure/frame";

// ============================================================================
// Base Types
// ============================================================================

export type SelectionMode = 'replace' | 'add' | 'remove' | 'intersect';

export interface SelectOpOptions {
    highlightColor?: [number, number, number, number];
    mode?: SelectionMode;
}

// ============================================================================
// Base SelectOp
// ============================================================================

/**
 * Base class for all selection operations.
 * Subclasses implement getSelectedIndices() to define selection logic.
 */
export abstract class BaseSelectOp extends BaseRenderOp {
    protected options: SelectOpOptions;
    protected selectionManager: SelectionManager | null = null;

    constructor(options: SelectOpOptions = {}, id?: string) {
        super(id);
        this.options = { mode: 'replace', ...options };
    }

    render(scene: Scene, frame: Frame, ctx: RenderOpContext): void {
        // Get or create selection manager from context
        if (!this.selectionManager) {
            this.selectionManager = ctx.selectionManager || new SelectionManager(scene, {
                highlightColor: this.options.highlightColor
            });
            ctx.selectionManager = this.selectionManager;
        }

        const atomMesh = this.findAtomMesh(scene);
        if (!atomMesh) return;

        const indicesToSelect = this.getSelectedIndices(frame, scene);
        this.applySelection(atomMesh, indicesToSelect);
    }

    /**
     * Subclasses implement this to define which atoms to select.
     */
    protected abstract getSelectedIndices(frame: Frame, scene: Scene): number[];

    protected applySelection(atomMesh: AbstractMesh, indices: number[]): void {
        if (!this.selectionManager) return;

        const mode = this.options.mode || 'replace';

        switch (mode) {
            case 'replace':
                this.selectionManager.clearAll();
                for (const index of indices) {
                    this.selectionManager.select(atomMesh, index);
                }
                break;

            case 'add':
                for (const index of indices) {
                    this.selectionManager.select(atomMesh, index);
                }
                break;

            case 'remove':
                for (const index of indices) {
                    this.selectionManager.deselect(atomMesh, index);
                }
                break;

            case 'intersect':
                const currentSelected = new Set(this.selectionManager.getSelectedIndices());
                const newSelected = new Set(indices);

                // Keep only atoms that are in both sets
                for (const index of currentSelected) {
                    if (!newSelected.has(index)) {
                        this.selectionManager.deselect(atomMesh, index);
                    }
                }
                break;
        }
    }

    protected findAtomMesh(scene: Scene): AbstractMesh | null {
        return scene.meshes.find(m => m.metadata?.meshType === 'atom') || null;
    }

    getSelectionManager(): SelectionManager | null {
        return this.selectionManager;
    }

    dispose(): void {
        // Don't clear selection on dispose - let pipeline manage lifecycle
    }
}

// ============================================================================
// Select by Indices
// ============================================================================

export interface SelectByIndicesOpOptions extends SelectOpOptions {
    indices: number[];
}

export class SelectByIndicesOp extends BaseSelectOp {
    private indices: number[];

    constructor(options: SelectByIndicesOpOptions, id?: string) {
        super(options, id);
        this.indices = options.indices;
    }

    protected getSelectedIndices(_frame: Frame, _scene: Scene): number[] {
        return this.indices;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            indices: this.indices,
        };
    }
}

// ============================================================================
// Select by Element
// ============================================================================

export interface SelectByElementOpOptions extends SelectOpOptions {
    elements: string[];
}

export class SelectByElementOp extends BaseSelectOp {
    private elements: Set<string>;

    constructor(options: SelectByElementOpOptions, id?: string) {
        super(options, id);
        this.elements = new Set(options.elements);
    }

    protected getSelectedIndices(frame: Frame, _scene: Scene): number[] {
        const indices: number[] = [];
        const atomBlock = frame.atomBlock;
        const count = atomBlock.n_atoms;

        try {
            const elements = atomBlock.get<string[]>("element");
            if (elements) {
                for (let i = 0; i < count; i++) {
                    if (this.elements.has(elements[i])) {
                        indices.push(i);
                    }
                }
            }
        } catch {
            // element field not found
        }

        return indices;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            elements: Array.from(this.elements),
        };
    }
}

// ============================================================================
// Select by Expression
// ============================================================================

export type SelectionPredicate = (atomIndex: number, frame: Frame) => boolean;

export interface SelectByExpressionOpOptions extends SelectOpOptions {
    predicate: SelectionPredicate;
    description?: string;
}

export class SelectByExpressionOp extends BaseSelectOp {
    private predicate: SelectionPredicate;
    private description: string;

    constructor(options: SelectByExpressionOpOptions, id?: string) {
        super(options, id);
        this.predicate = options.predicate;
        this.description = options.description || "custom expression";
    }

    protected getSelectedIndices(frame: Frame, _scene: Scene): number[] {
        const indices: number[] = [];
        const count = frame.atomBlock.n_atoms;

        for (let i = 0; i < count; i++) {
            if (this.predicate(i, frame)) {
                indices.push(i);
            }
        }

        return indices;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            description: this.description,
        };
    }
}

// ============================================================================
// Invert Selection
// ============================================================================

export class InvertSelectionOp extends BaseSelectOp {
    constructor(options: SelectOpOptions = {}, id?: string) {
        super({ ...options, mode: 'replace' }, id);
    }

    protected getSelectedIndices(frame: Frame, _scene: Scene): number[] {
        if (!this.selectionManager) return [];

        const currentlySelected = new Set(
            this.selectionManager.getSelectedIndices()
        );

        const indices: number[] = [];
        const count = frame.atomBlock.n_atoms;

        for (let i = 0; i < count; i++) {
            if (!currentlySelected.has(i)) {
                indices.push(i);
            }
        }

        return indices;
    }
}

// ============================================================================
// Clear Selection
// ============================================================================

export class ClearSelectionOp extends BaseSelectOp {
    render(_scene: Scene, _frame: Frame, ctx: RenderOpContext): void {
        if (ctx.selectionManager) {
            ctx.selectionManager.clearAll();
        }
    }

    protected getSelectedIndices(): number[] {
        return [];
    }
}

// ============================================================================
// Boolean Operations
// ============================================================================

export type BooleanOperation = 'and' | 'or' | 'not' | 'xor';

export interface BooleanSelectOpOptions extends SelectOpOptions {
    operation: BooleanOperation;
    operands: BaseSelectOp[];
}

/**
 * Combine multiple selection operations with boolean logic.
 * 
 * Examples:
 * - AND: Select atoms that match ALL operands
 * - OR: Select atoms that match ANY operand
 * - NOT: Select atoms that DON'T match the operand
 * - XOR: Select atoms that match exactly ONE operand
 */
export class BooleanSelectOp extends BaseSelectOp {
    private operation: BooleanOperation;
    private operands: BaseSelectOp[];

    constructor(options: BooleanSelectOpOptions, id?: string) {
        super(options, id);
        this.operation = options.operation;
        this.operands = options.operands;
    }

    protected getSelectedIndices(frame: Frame, scene: Scene): number[] {
        // Get indices from each operand
        const operandResults: Set<number>[] = this.operands.map(op =>
            new Set(op['getSelectedIndices'](frame, scene))
        );

        switch (this.operation) {
            case 'and':
                return this.intersectAll(operandResults);

            case 'or':
                return this.unionAll(operandResults);

            case 'not':
                // NOT operation: all atoms except those in first operand
                if (operandResults.length === 0) return [];
                const allIndices = Array.from({ length: frame.atomBlock.n_atoms }, (_, i) => i);
                return allIndices.filter(i => !operandResults[0].has(i));

            case 'xor':
                return this.xorAll(operandResults);

            default:
                return [];
        }
    }

    private intersectAll(sets: Set<number>[]): number[] {
        if (sets.length === 0) return [];
        if (sets.length === 1) return Array.from(sets[0]);

        const result = new Set(sets[0]);
        for (let i = 1; i < sets.length; i++) {
            for (const item of result) {
                if (!sets[i].has(item)) {
                    result.delete(item);
                }
            }
        }
        return Array.from(result);
    }

    private unionAll(sets: Set<number>[]): number[] {
        const result = new Set<number>();
        for (const set of sets) {
            for (const item of set) {
                result.add(item);
            }
        }
        return Array.from(result);
    }

    private xorAll(sets: Set<number>[]): number[] {
        const counts = new Map<number, number>();

        for (const set of sets) {
            for (const item of set) {
                counts.set(item, (counts.get(item) || 0) + 1);
            }
        }

        // XOR: items that appear in exactly one set
        const result: number[] = [];
        for (const [item, count] of counts) {
            if (count === 1) {
                result.push(item);
            }
        }
        return result;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            operation: this.operation,
            operands: this.operands.map(op => op.toJSON()),
        };
    }
}
