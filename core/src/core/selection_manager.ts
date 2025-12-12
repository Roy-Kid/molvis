import { Scene, AbstractMesh, Mesh } from "@babylonjs/core";

export interface SelectionOptions {
    highlightColor?: [number, number, number, number];
}

/**
 * Manages selection state and highlighting for atoms.
 * Used by both SelectMode (interactive) and SelectOps (programmatic).
 */
export class SelectionManager {
    private selectedAtoms: Set<string> = new Set();
    private originalColorCache: Map<string, Float32Array> = new Map();
    private scene: Scene;
    private highlightColor: [number, number, number, number];

    constructor(scene: Scene, options?: SelectionOptions) {
        this.scene = scene;
        this.highlightColor = options?.highlightColor || [1.0, 1.0, 0.0, 1.0];
    }

    /**
     * Select an atom and apply highlight.
     */
    select(mesh: AbstractMesh, instanceIndex: number): boolean {
        if (!(mesh instanceof Mesh)) return false;
        const key = `${mesh.id}:${instanceIndex}`;
        if (this.selectedAtoms.has(key)) return false;
        this.selectedAtoms.add(key);
        this.applyHighlight(mesh, instanceIndex, key);
        return true;
    }

    /**
     * Deselect an atom and restore original color.
     */
    deselect(mesh: AbstractMesh, instanceIndex: number): boolean {
        if (!(mesh instanceof Mesh)) return false;
        const key = `${mesh.id}:${instanceIndex}`;
        if (!this.selectedAtoms.has(key)) return false;
        this.selectedAtoms.delete(key);
        this.restoreColor(mesh, instanceIndex, key);
        return true;
    }

    /**
     * Toggle selection state.
     */
    toggle(mesh: AbstractMesh, instanceIndex: number): boolean {
        const key = `${mesh.id}:${instanceIndex}`;
        if (this.selectedAtoms.has(key)) {
            return this.deselect(mesh, instanceIndex);
        } else {
            return this.select(mesh, instanceIndex);
        }
    }

    /**
     * Check if an atom is selected.
     */
    isSelected(mesh: AbstractMesh, instanceIndex: number): boolean {
        const key = `${mesh.id}:${instanceIndex}`;
        return this.selectedAtoms.has(key);
    }

    /**
     * Get all selected atoms.
     */
    getSelected(): Array<{ meshId: string; instanceIndex: number }> {
        return Array.from(this.selectedAtoms).map(key => {
            const [meshId, indexStr] = key.split(':');
            return { meshId, instanceIndex: parseInt(indexStr) };
        });
    }

    /**
     * Get selected atom indices.
     */
    getSelectedIndices(): number[] {
        return this.getSelected().map(s => s.instanceIndex);
    }

    /**
     * Clear all selections and restore colors.
     */
    clearAll(): void {
        for (const key of this.selectedAtoms) {
            const [meshId, indexStr] = key.split(':');
            const instanceIndex = parseInt(indexStr);
            const mesh = this.scene.getMeshById(meshId);
            if (mesh instanceof Mesh) {
                this.restoreColor(mesh, instanceIndex, key);
            }
        }
        this.selectedAtoms.clear();
        this.originalColorCache.clear();
    }

    /**
     * Reapply highlights (e.g., after mode enter or scene change).
     */
    reapplyHighlights(): void {
        for (const key of this.selectedAtoms) {
            const [meshId, indexStr] = key.split(':');
            const instanceIndex = parseInt(indexStr);
            const mesh = this.scene.getMeshById(meshId);
            if (mesh instanceof Mesh) {
                this.applyHighlight(mesh, instanceIndex, key);
            }
        }
    }

    /**
     * Set highlight color and reapply to all selected atoms.
     */
    setHighlightColor(color: [number, number, number, number]): void {
        this.highlightColor = color;
        this.reapplyHighlights();
    }

    private applyHighlight(mesh: Mesh, instanceIndex: number, key: string): void {
        const colorBuffer = mesh.metadata?.colorBuffer as Float32Array;
        if (!colorBuffer) return;

        // Save original color if not already saved
        if (!this.originalColorCache.has(key)) {
            const offset = instanceIndex * 4;
            this.originalColorCache.set(key, new Float32Array([
                colorBuffer[offset],
                colorBuffer[offset + 1],
                colorBuffer[offset + 2],
                colorBuffer[offset + 3]
            ]));
        }

        // Apply highlight color
        const offset = instanceIndex * 4;
        colorBuffer[offset] = this.highlightColor[0];
        colorBuffer[offset + 1] = this.highlightColor[1];
        colorBuffer[offset + 2] = this.highlightColor[2];
        colorBuffer[offset + 3] = this.highlightColor[3];

        mesh.thinInstanceBufferUpdated("color");
    }

    private restoreColor(mesh: Mesh, instanceIndex: number, key: string): void {
        const originalColor = this.originalColorCache.get(key);
        if (!originalColor) return;

        const colorBuffer = mesh.metadata?.colorBuffer as Float32Array;
        if (!colorBuffer) return;

        const offset = instanceIndex * 4;
        colorBuffer[offset] = originalColor[0];
        colorBuffer[offset + 1] = originalColor[1];
        colorBuffer[offset + 2] = originalColor[2];
        colorBuffer[offset + 3] = originalColor[3];

        mesh.thinInstanceBufferUpdated("color");
        this.originalColorCache.delete(key);
    }
}
