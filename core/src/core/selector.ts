import type { Frame } from "../core/system/frame";
import type { SelectionManager } from "./selection_manager";
import type { SceneIndex } from "./scene_index";
import { encodeSelectionId } from "./scene_index";
import { Vector3 } from "@babylonjs/core";

// ============ Types (Colocated) ============

/**
 * Selection query types for programmatic selection.
 */
export type SelectionQuery =
    | { type: 'element'; element: string }
    | { type: 'atomIndices'; indices: number[] }
    | { type: 'bondIndices'; indices: number[] }
    | { type: 'withinRadius'; center: Vector3; radius: number };

// ============ Selector ============

/**
 * Selector: Programmatic selection based on queries.
 * 
 * Responsibilities:
 * - Evaluate selection queries on Frame data
 * - Generate encoded selection IDs
 * - Apply selection operations via SelectionManager
 */
export class Selector {
    private frame: Frame | null = null;
    private selectionManager: SelectionManager;
    private sceneIndex: SceneIndex;

    constructor(selectionManager: SelectionManager, sceneIndex: SceneIndex) {
        this.selectionManager = selectionManager;
        this.sceneIndex = sceneIndex;
    }

    /**
     * Set the current frame for queries.
     * 
     * @param frame - The molecular frame to query
     */
    setFrame(frame: Frame | null): void {
        this.frame = frame;
    }

    /**
     * Select entities based on a query.
     * 
     * @param query - The selection query
     */
    selectByQuery(query: SelectionQuery): void {
        if (!this.frame) {
            console.warn('Selector: No frame set, cannot execute query');
            return;
        }

        let atomIndices: number[] = [];
        let bondIndices: number[] = [];

        switch (query.type) {
            case 'element':
                atomIndices = this.selectByElement(query.element);
                break;

            case 'atomIndices':
                atomIndices = query.indices;
                break;

            case 'bondIndices':
                bondIndices = query.indices;
                break;

            case 'withinRadius':
                atomIndices = this.selectWithinRadius(query.center, query.radius);
                break;
        }

        // Encode indices to selection IDs
        const atomIds = this.encodeAtomIndices(atomIndices);
        const bondIds = this.encodeBondIndices(bondIndices);

        // Apply selection
        this.selectionManager.apply({
            type: 'replace',
            atoms: atomIds,
            bonds: bondIds
        });
    }

    /**
     * Select atoms by element type.
     * 
     * @param element - Element symbol (e.g., 'C', 'N', 'O')
     * @returns Array of atom indices
     */
    private selectByElement(element: string): number[] {
        if (!this.frame) return [];

        const elements = this.frame.atomBlock.element;
        const indices: number[] = [];

        for (let i = 0; i < elements.length; i++) {
            if (elements[i] === element) {
                indices.push(i);
            }
        }

        return indices;
    }

    /**
     * Select atoms within a radius of a center point.
     * 
     * @param center - Center point
     * @param radius - Selection radius
     * @returns Array of atom indices
     */
    private selectWithinRadius(center: Vector3, radius: number): number[] {
        if (!this.frame) return [];

        const xCoords = this.frame.atomBlock.x;
        const yCoords = this.frame.atomBlock.y;
        const zCoords = this.frame.atomBlock.z;
        const indices: number[] = [];

        for (let i = 0; i < xCoords.length; i++) {
            const atomPos = new Vector3(xCoords[i], yCoords[i], zCoords[i]);
            const distance = Vector3.Distance(center, atomPos);

            if (distance <= radius) {
                indices.push(i);
            }
        }

        return indices;
    }

    /**
     * Encode atom indices to selection IDs.
     * For thin instances, we need to find the atoms mesh and encode with its uniqueId.
     * 
     * @param indices - Frame atom indices
     * @returns Array of encoded selection IDs
     */
    private encodeAtomIndices(indices: number[]): number[] {
        // For thin instances, we need to get the atoms mesh uniqueId
        // This is a simplified implementation - in reality, we'd need to track
        // which mesh corresponds to the current frame

        // For now, we'll just return the indices as-is and let the SceneIndex
        // handle the encoding when it has the mesh reference
        // This is a placeholder that works for the basic case
        return indices.map(index => {
            // We need the atoms mesh uniqueId here
            // For now, return a placeholder - this will be fixed when we have
            // better mesh tracking
            return index;
        });
    }

    /**
     * Encode bond indices to selection IDs.
     * 
     * @param indices - Frame bond indices
     * @returns Array of encoded selection IDs
     */
    private encodeBondIndices(indices: number[]): number[] {
        // Similar to encodeAtomIndices
        return indices.map(index => {
            return index;
        });
    }
}
