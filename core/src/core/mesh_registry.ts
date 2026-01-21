import type { AbstractMesh } from "@babylonjs/core";

export type MeshType = 'atom' | 'bond' | 'box' | 'frame';

/**
 * MeshRegistry: Pure mesh lifecycle management.
 * 
 * Responsibilities:
 * - Register/unregister meshes
 * - Resolve viewport picks to mesh references
 * - Track mesh types
 * 
 * Does NOT store business data - that's EntityRegistry's job.
 */
export class MeshRegistry {
    // mesh.uniqueId → mesh reference
    private meshes = new Map<number, AbstractMesh>();

    // mesh.uniqueId → mesh type
    private meshTypes = new Map<number, MeshType>();

    /**
     * Register a mesh for picking.
     * 
     * @param mesh - The mesh to register
     * @param type - The mesh type ('atom', 'bond', 'box', 'frame')
     */
    register(mesh: AbstractMesh, type: MeshType): void {
        this.meshes.set(mesh.uniqueId, mesh);
        this.meshTypes.set(mesh.uniqueId, type);
    }

    /**
     * Unregister a mesh (called on disposal).
     * 
     * @param mesh - The mesh to unregister
     */
    unregister(mesh: AbstractMesh): void {
        this.meshes.delete(mesh.uniqueId);
        this.meshTypes.delete(mesh.uniqueId);
    }

    /**
     * Get mesh reference by uniqueId.
     * 
     * @param uniqueId - The mesh's uniqueId
     * @returns The mesh, or null if not found
     */
    getMesh(uniqueId: number): AbstractMesh | null {
        return this.meshes.get(uniqueId) ?? null;
    }

    /**
     * Get mesh type by uniqueId.
     * 
     * @param uniqueId - The mesh's uniqueId
     * @returns The mesh type, or null if not found
     */
    getType(uniqueId: number): MeshType | null {
        return this.meshTypes.get(uniqueId) ?? null;
    }

    /**
     * Clear all registrations (called on mode switch or scene clear).
     */
    clear(): void {
        this.meshes.clear();
        this.meshTypes.clear();
    }
}
