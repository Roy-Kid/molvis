import { Vector3, type AbstractMesh, type Mesh } from "@babylonjs/core";
import type { SceneIndex } from "./scene_index";
import type { MolvisApp } from "./app";
import type { EditMode } from "../mode/edit";
import { logger } from "../utils/logger";

/**
 * Extract 3D position from a transformation matrix buffer.
 * 
 * @param buffer - Float32Array containing transformation matrices (16 floats per instance)
 * @param thinIndex - Index of the thin instance
 * @returns Vector3 position extracted from the matrix
 */
export function getPositionFromMatrix(buffer: Float32Array, thinIndex: number): Vector3 {
    const offset = thinIndex * 16;
    return new Vector3(
        buffer[offset + 12],
        buffer[offset + 13],
        buffer[offset + 14]
    );
}

/**
 * Extract atom position from a thin instance mesh.
 * 
 * @param mesh - The mesh containing thin instance atoms
 * @param instanceIndex - Index of the thin instance
 * @returns Vector3 position or null if invalid
 * 
 * @example
 * ```typescript
 * const position = getAtomPositionFromThinInstance(atomMesh, 5);
 * if (position) {
 *   console.log(`Atom at (${position.x}, ${position.y}, ${position.z})`);
 * }
 * ```
 */
export function getAtomPositionFromThinInstance(
    mesh: AbstractMesh,
    instanceIndex: number,
    sceneIndex?: SceneIndex
): Vector3 | null {
    if (!sceneIndex) {
        return null;
    }

    if (instanceIndex < 0) {
        return null;
    }

    const meta = sceneIndex.getMeta(mesh.uniqueId, instanceIndex);
    if (!meta || meta.type !== 'atom') {
        return null;
    }

    return new Vector3(meta.position.x, meta.position.y, meta.position.z);
}

/**
 * Extract bond endpoint positions from a thin instance mesh.
 * 
 * @param mesh - The mesh containing thin instance bonds
 * @param instanceIndex - Index of the thin instance
 * @returns Object with start, end positions and bond length, or null if invalid
 * 
 * @example
 * ```typescript
 * const bondInfo = getBondEndpointsFromThinInstance(bondMesh, 10);
 * if (bondInfo) {
 *
 *   const bondInfo = meta; // meta is bond info for 'bond' type
 * }
 * ```
 */
export function getBondEndpointsFromThinInstance(
    mesh: AbstractMesh,
    instanceIndex: number,
    sceneIndex?: SceneIndex
): { start: Vector3; end: Vector3; length: number } | null {
    if (!sceneIndex) {
        return null;
    }

    if (instanceIndex < 0) {
        return null;
    }

    const meta = sceneIndex.getMeta(mesh.uniqueId, instanceIndex);
    if (!meta || meta.type !== 'bond') {
        return null;
    }

    const start = new Vector3(meta.start.x, meta.start.y, meta.start.z);
    const end = new Vector3(meta.end.x, meta.end.y, meta.end.z);

    return {
        start,
        end,
        length: Vector3.Distance(start, end),
    };
}


/**
 * Convert a specific thin instance to an editable mesh.
 * This enables editing of atoms that were originally loaded from a Frame.
 * 
 * @param thinInstanceMesh The base mesh containing thin instances
 * @param instanceIndex The index of the specific thin instance to convert
 * @param app The MolvisApp instance
 * @returns The newly created mesh, or null if conversion failed
 */
export function convertThinInstanceToMesh(
    thinInstanceMesh: Mesh,
    instanceIndex: number,
    app: MolvisApp
): Mesh | null {
    const meta = app.world.sceneIndex.getMeta(thinInstanceMesh.uniqueId, instanceIndex);
    if (!meta || meta.type !== 'atom') {
        logger.error('[convertThinInstanceToMesh] Missing thin instance data');
        return null;
    }

    if (instanceIndex < 0) {
        logger.error(`[convertThinInstanceToMesh] Invalid instance index: ${instanceIndex}`);
        return null;
    }

    const position = new Vector3(meta.position.x, meta.position.y, meta.position.z);
    const element = meta.element;
    const radius = app.styleManager.getAtomStyle(element).radius;

    // Create new mesh using Artist (only available in Edit mode)
    const mode = app.mode;
    if (!mode || mode.type !== 'edit') {
        logger.error('[convertThinInstanceToMesh] Can only convert thin instances in Edit mode');
        return null;
    }

    const editMode = mode as unknown as EditMode;
    const newMesh = editMode.artist?.drawAtom(position, {
        element,
        name: element,
        radius
    });

    if (!newMesh) {
        logger.error('[convertThinInstanceToMesh] Failed to create mesh via Artist');
        return null;
    }

    // Note: We don't remove the thin instance here because Babylon.js doesn't support
    // removing individual thin instances. Instead, we'll mark it as converted or
    // handle it during the next frame redraw.
    // For now, the thin instance will remain visible but the mesh will be on top.

    newMesh.refreshBoundingInfo();

    return newMesh;
}

/**
 * Check if a mesh is a thin instance base mesh.
 * 
 * @param mesh The mesh to check
 * @returns True if the mesh is a thin instance base
 */
export function isThinInstanceMesh(mesh: Mesh, sceneIndex?: SceneIndex): boolean {
    if (!mesh.hasThinInstances) {
        return false;
    }

    if (!sceneIndex) {
        return true;
    }

    const type = sceneIndex.getType(mesh.uniqueId);
    return type === 'atom' || type === 'bond';
}

/**
 * Get the thin instance index from a pick result.
 * 
 * @param mesh The picked mesh
 * @param thinInstanceIndex The thin instance index from the pick result
 * @returns The thin instance index, or -1 if not a thin instance
 */
export function getThinInstanceIndex(mesh: Mesh, thinInstanceIndex?: number, sceneIndex?: SceneIndex): number {
    if (thinInstanceIndex === undefined || thinInstanceIndex === -1) {
        return -1;
    }

    if (!mesh.hasThinInstances) {
        return -1;
    }

    if (sceneIndex) {
        const meta = sceneIndex.getMeta(mesh.uniqueId, thinInstanceIndex);
        if (!meta) return -1;
    }

    return thinInstanceIndex;
}
