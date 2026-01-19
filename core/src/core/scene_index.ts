import type { AbstractMesh, Mesh } from "@babylonjs/core";

// ============ Bit-Encoding Utilities ============

/**
 * Encode mesh.uniqueId and thinInstanceIndex into a single number.
 * 
 * Encoding scheme:
 * - High 32 bits: uniqueId
 * - Low 32 bits: thinIndex + 1 (so -1 becomes 0)
 * 
 * @param uniqueId - The mesh's uniqueId
 * @param thinIndex - Optional thin instance index
 * @returns Encoded selection ID as a single number
 * 
 * @example
 * encodeSelectionId(123) → 527765581824 (independent mesh)
 * encodeSelectionId(456, 5) → 1958505086982 (thin instance)
 */
export function encodeSelectionId(uniqueId: number, thinIndex?: number): number {
    const index = thinIndex !== undefined ? thinIndex : -1;
    return uniqueId * 0x100000000 + (index + 1);
}

/**
 * Decode an encoded selection ID back to uniqueId and optional thinIndex.
 * 
 * @param encoded - The encoded selection ID
 * @returns Object with uniqueId and optional thinIndex
 */
export function decodeSelectionId(encoded: number): { uniqueId: number; thinIndex?: number } {
    const uniqueId = Math.floor(encoded / 0x100000000);
    const indexPlusOne = encoded % 0x100000000;
    const index = indexPlusOne - 1;

    return index === -1
        ? { uniqueId }
        : { uniqueId, thinIndex: index };
}

// ============ SceneIndex ============

/**
 * SceneIndex: Bidirectional mapping using encoded selection IDs.
 * Supports both thin instances and independent meshes.
 * 
 * Responsibilities:
 * - Forward mapping: viewport pick → encoded selection ID
 * - Reverse mapping: encoded selection ID → render reference
 * - Registration of meshes (both thin instances and independent)
 */
export class SceneIndex {
    // Forward: mesh.uniqueId → type
    private meshTypes = new Map<number, 'atom' | 'bond'>();

    // Reverse: mesh.uniqueId → mesh reference
    private meshRefs = new Map<number, AbstractMesh>();

    /**
     * Resolve viewport pick to encoded selection ID (one-step).
     * 
     * @param mesh - The picked mesh
     * @param thinIndex - Optional thin instance index from pick result
     * @returns Encoded selection ID, or null if mesh not registered
     */
    resolvePickToId(mesh: AbstractMesh | null, thinIndex?: number): number | null {
        if (!mesh) return null;
        if (!this.meshTypes.has(mesh.uniqueId)) return null;

        return encodeSelectionId(mesh.uniqueId, thinIndex);
    }

    /**
     * Get type for encoded selection ID.
     * 
     * @param encodedId - The encoded selection ID
     * @returns 'atom' or 'bond', or null if not found
     */
    getType(encodedId: number): 'atom' | 'bond' | null {
        const { uniqueId } = decodeSelectionId(encodedId);
        return this.meshTypes.get(uniqueId) || null;
    }

    /**
     * Get render reference for highlighting.
     * 
     * @param encodedId - The encoded selection ID
     * @returns Object with mesh and optional thinIndex, or null if not found
     */
    getRenderRef(encodedId: number): { mesh: AbstractMesh; thinIndex?: number } | null {
        const { uniqueId, thinIndex } = decodeSelectionId(encodedId);
        const mesh = this.meshRefs.get(uniqueId);
        if (!mesh) return null;

        return { mesh, thinIndex };
    }

    /**
     * Register thin instance mesh (View mode).
     * 
     * @param mesh - The thin instance mesh
     * @param type - 'atom' or 'bond'
     */
    registerThinInstances(mesh: Mesh, type: 'atom' | 'bond'): void {
        this.meshTypes.set(mesh.uniqueId, type);
        this.meshRefs.set(mesh.uniqueId, mesh);
    }

    /**
     * Register individual mesh (Edit mode or user-created).
     * 
     * @param mesh - The individual mesh
     * @param type - 'atom' or 'bond'
     */
    registerMesh(mesh: Mesh, type: 'atom' | 'bond'): void {
        this.meshTypes.set(mesh.uniqueId, type);
        this.meshRefs.set(mesh.uniqueId, mesh);
    }

    /**
     * Unregister a mesh.
     * 
     * @param mesh - The mesh to unregister
     */
    unregister(mesh: Mesh): void {
        this.meshTypes.delete(mesh.uniqueId);
        this.meshRefs.delete(mesh.uniqueId);
    }

    /**
     * Clear all registrations (called on mode switch).
     */
    clear(): void {
        this.meshTypes.clear();
        this.meshRefs.clear();
    }
}
