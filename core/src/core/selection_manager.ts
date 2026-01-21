import type { SceneIndex } from "./scene_index";

export type SelectionKey = string;

export interface SelectionRef {
    meshId: number;
    subIndex?: number;
}

export function makeSelectionKey(meshId: number, subIndex?: number): SelectionKey {
    return subIndex === undefined ? String(meshId) : `${meshId}:${subIndex}`;
}

export function parseSelectionKey(key: SelectionKey): SelectionRef | null {
    const [meshPart, subPart] = key.split(":");
    if (!meshPart) return null;

    const meshId = Number(meshPart);
    if (!Number.isFinite(meshId)) return null;

    if (subPart === undefined || subPart === "") {
        return { meshId };
    }

    const subIndex = Number(subPart);
    if (!Number.isFinite(subIndex)) {
        return { meshId };
    }

    return { meshId, subIndex };
}

// ============ Types (Colocated) ============

/**
 * Selection state using selection keys.
 */
export interface SelectionState {
    atoms: Set<SelectionKey>;
    bonds: Set<SelectionKey>;
}

export interface SelectedEntity {
    type: 'atom' | 'bond';
    meshId: number;
    instanceIndex: number;
}

/**
 * Selection operations.
 */
export type SelectionOp =
    | { type: 'replace'; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
    | { type: 'add'; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
    | { type: 'remove'; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
    | { type: 'toggle'; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
    | { type: 'clear' };

// ============ SelectionManager ============

/**
 * SelectionManager: Maintains selection state using selection keys.
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
     * Check if a selection key is selected.
     * 
     * @param key - The selection key
     * @returns true if selected, false otherwise
     */
    isSelected(key: SelectionKey): boolean {
        const ref = parseSelectionKey(key);
        if (!ref) return false;

        const meta = this.sceneIndex.getMeta(ref.meshId, ref.subIndex);
        if (!meta) return false;

        if (meta.type === 'atom') {
            return this.state.atoms.has(key);
        }
        if (meta.type === 'bond') {
            return this.state.bonds.has(key);
        }
        return false;
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
