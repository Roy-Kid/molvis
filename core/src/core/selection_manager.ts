import type { SceneIndex } from "./scene_index";

// ============ Types (Colocated) ============

/**
 * Selection state using encoded selection IDs.
 */
export interface SelectionState {
    atoms: Set<number>;  // Encoded selection IDs for atoms
    bonds: Set<number>;  // Encoded selection IDs for bonds
}

/**
 * Selection operations.
 */
export type SelectionOp =
    | { type: 'replace'; atoms?: number[]; bonds?: number[] }
    | { type: 'add'; atoms?: number[]; bonds?: number[] }
    | { type: 'remove'; atoms?: number[]; bonds?: number[] }
    | { type: 'toggle'; atoms?: number[]; bonds?: number[] }
    | { type: 'clear' };

// ============ SelectionManager ============

/**
 * SelectionManager: Maintains selection state using encoded IDs.
 * Emits events for highlighting.
 * 
 * Responsibilities:
 * - Maintain selection state (atoms and bonds)
 * - Apply selection operations
 * - Emit change events for highlighting
 */
export class SelectionManager {
    private state: SelectionState = { atoms: new Set(), bonds: new Set() };
    private listeners: Array<(state: SelectionState) => void> = [];
    private sceneIndex: SceneIndex;

    constructor(sceneIndex: SceneIndex) {
        this.sceneIndex = sceneIndex;
    }

    /**
     * Apply a selection operation.
     * 
     * @param op - The selection operation to apply
     */
    apply(op: SelectionOp): void {
        switch (op.type) {
            case 'replace':
                this.state.atoms = new Set(op.atoms || []);
                this.state.bonds = new Set(op.bonds || []);
                break;

            case 'add':
                op.atoms?.forEach(id => this.state.atoms.add(id));
                op.bonds?.forEach(id => this.state.bonds.add(id));
                break;

            case 'remove':
                op.atoms?.forEach(id => this.state.atoms.delete(id));
                op.bonds?.forEach(id => this.state.bonds.delete(id));
                break;

            case 'toggle':
                op.atoms?.forEach(id => {
                    if (this.state.atoms.has(id)) {
                        this.state.atoms.delete(id);
                    } else {
                        this.state.atoms.add(id);
                    }
                });
                op.bonds?.forEach(id => {
                    if (this.state.bonds.has(id)) {
                        this.state.bonds.delete(id);
                    } else {
                        this.state.bonds.add(id);
                    }
                });
                break;

            case 'clear':
                this.state.atoms.clear();
                this.state.bonds.clear();
                break;
        }

        this.emit();
    }

    /**
     * Check if an encoded ID is selected.
     * 
     * @param encodedId - The encoded selection ID
     * @returns true if selected, false otherwise
     */
    isSelected(encodedId: number): boolean {
        const type = this.sceneIndex.getType(encodedId);
        if (!type) return false;

        return type === 'atom'
            ? this.state.atoms.has(encodedId)
            : this.state.bonds.has(encodedId);
    }

    /**
     * Get the current selection state.
     * 
     * @returns The current selection state
     */
    getState(): SelectionState {
        return this.state;
    }

    /**
     * Register a change event listener.
     * 
     * @param handler - Function to call when selection changes
     */
    on(handler: (state: SelectionState) => void): void {
        this.listeners.push(handler);
    }

    /**
     * Emit change event to all listeners.
     */
    private emit(): void {
        this.listeners.forEach(fn => fn(this.state));
    }
}
