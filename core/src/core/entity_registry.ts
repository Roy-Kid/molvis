import type { Vector3 } from "@babylonjs/core";
import type { Block } from "molrs-wasm";

/**
 * Thin instance data (view mode).
 * Stores rendering cache and references to Frame data.
 */
export interface ThinInstanceData {
    matrices: Float32Array;
    colorBuffer: Float32Array;
    atomBlock?: Block;  // Reference to Frame atom data
    bondBlock?: Block;  // Reference to Frame bond data
    i?: Uint32Array;    // Bond topology (atom indices)
    j?: Uint32Array;    // Bond topology (atom indices)
    count: number;      // Number of instances
    elements?: string[]; // Element symbols (for atoms)
}

/**
 * Edit mode mesh data.
 * Stores properties for individually created atoms/bonds.
 */
export interface EditMeshData {
    atomId?: number;
    bondId?: number;
    element?: string;
    position?: Vector3;
    name?: string;
    names?: string[];
    order?: number;     // Bond order
    atomId1?: number;   // Bond endpoint 1
    atomId2?: number;   // Bond endpoint 2
    x1?: number;        // Bond start position
    y1?: number;
    z1?: number;
    x2?: number;        // Bond end position
    y2?: number;
    z2?: number;
}

/**
 * Frame-level data.
 * Stores Frame blocks and box information.
 */
export interface FrameData {
    atomBlock: Block;
    bondBlock?: Block;
    box?: any;  // Box type from molrs-wasm
}

/**
 * EntityRegistry: Business data storage with 1:1 correspondence to MeshRegistry.
 * 
 * Responsibilities:
 * - Store thin instance data (view mode)
 * - Store edit mesh data (edit mode)
 * - Store frame-level data
 * - Provide generic query interfaces
 * 
 * Does NOT know about selection, highlighting, or other business logic.
 */
export class EntityRegistry {
    // mesh.uniqueId → thin instance data
    private thinInstanceData = new Map<number, ThinInstanceData>();

    // mesh.uniqueId → edit mesh data
    private editMeshData = new Map<number, EditMeshData>();

    // Frame-level data (single frame for now)
    private frameData: FrameData | null = null;

    /**
     * Store thin instance data for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @param data - The thin instance data
     */
    setThinInstanceData(meshId: number, data: ThinInstanceData): void {
        this.thinInstanceData.set(meshId, data);
    }

    /**
     * Store edit mesh data for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @param data - The edit mesh data
     */
    setEditMeshData(meshId: number, data: EditMeshData): void {
        this.editMeshData.set(meshId, data);
    }

    /**
     * Store frame-level data.
     * 
     * @param data - The frame data
     */
    setFrameData(data: FrameData): void {
        this.frameData = data;
    }

    /**
     * Get thin instance data for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @returns The thin instance data, or null if not found
     */
    getThinInstanceData(meshId: number): ThinInstanceData | null {
        return this.thinInstanceData.get(meshId) ?? null;
    }

    /**
     * Get edit mesh data for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @returns The edit mesh data, or null if not found
     */
    getEditMeshData(meshId: number): EditMeshData | null {
        return this.editMeshData.get(meshId) ?? null;
    }

    /**
     * Get frame-level data.
     * 
     * @returns The frame data, or null if not set
     */
    getFrameData(): FrameData | null {
        return this.frameData;
    }

    /**
     * Remove data for a specific mesh.
     * 
     * @param meshId - The mesh's uniqueId
     */
    removeMeshData(meshId: number): void {
        this.thinInstanceData.delete(meshId);
        this.editMeshData.delete(meshId);
    }

    /**
     * Clear all stored data (called on mode switch or scene clear).
     */
    clear(): void {
        this.thinInstanceData.clear();
        this.editMeshData.clear();
        this.frameData = null;
    }
}
