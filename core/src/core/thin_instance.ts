import { Vector3, type AbstractMesh, type Mesh } from "@babylonjs/core";
import type { MeshMetadata } from "../commands/draw";
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
    instanceIndex: number
): Vector3 | null {
    const metadata = mesh.metadata as MeshMetadata;

    if (!metadata || metadata.meshType !== "atom" || !metadata.matrices) {
        return null;
    }

    if (instanceIndex < 0 || instanceIndex * 16 >= metadata.matrices.length) {
        return null;
    }

    return getPositionFromMatrix(metadata.matrices, instanceIndex);
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
 *   console.log(`Bond from ${bondInfo.start} to ${bondInfo.end}`);
 *   console.log(`Length: ${bondInfo.length.toFixed(2)} Å`);
 * }
 * ```
 */
export function getBondEndpointsFromThinInstance(
    mesh: AbstractMesh,
    instanceIndex: number
): { start: Vector3; end: Vector3; length: number } | null {
    const metadata = mesh.metadata as MeshMetadata;

    if (
        !metadata ||
        metadata.meshType !== "bond" ||
        !metadata.i ||
        !metadata.j ||
        !metadata.atomBlock
    ) {
        return null;
    }

    if (instanceIndex < 0 || instanceIndex >= metadata.i.length) {
        return null;
    }

    const i = metadata.i[instanceIndex];
    const j = metadata.j[instanceIndex];

    const atomBlock = metadata.atomBlock;

    const start = new Vector3(
        atomBlock.x[i],
        atomBlock.y[i],
        atomBlock.z[i]
    );

    const end = new Vector3(
        atomBlock.x[j],
        atomBlock.y[j],
        atomBlock.z[j]
    );

    return {
        start,
        end,
        length: Vector3.Distance(start, end),
    };
}

/**
 * Get metadata for a thin instance mesh.
 * 
 * @param mesh - The mesh to get metadata from
 * @returns MeshMetadata or null if invalid
 */
export function getThinInstanceMetadata(
    mesh: AbstractMesh
): MeshMetadata | null {
    const metadata = mesh.metadata as MeshMetadata;

    if (!metadata || !metadata.meshType) {
        return null;
    }

    return metadata;
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
    const metadata = thinInstanceMesh.metadata as MeshMetadata;

    if (!metadata || metadata.meshType !== 'atom') {
        console.error('[convertThinInstanceToMesh] Not an atom mesh');
        return null;
    }

    if (!metadata.matrices || !metadata.atomBlock) {
        console.error('[convertThinInstanceToMesh] Missing thin instance data');
        return null;
    }

    if (instanceIndex < 0 || instanceIndex >= (metadata.atomCount || 0)) {
        console.error(`[convertThinInstanceToMesh] Invalid instance index: ${instanceIndex}`);
        return null;
    }

    // Extract atom data from thin instance
    const position = getPositionFromMatrix(metadata.matrices, instanceIndex);
    const element = metadata.atomBlock.element[instanceIndex];
    const name = metadata.names?.[instanceIndex];

    // Get radius from transformation matrix (scale)
    const offset = instanceIndex * 16;
    const scale = metadata.matrices[offset]; // Assuming uniform scaling
    const radius = scale / 2; // Convert diameter to radius

    console.log(`[convertThinInstanceToMesh] Converting thin instance ${instanceIndex}: ${element} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

    // Create new mesh using Artist (only available in Edit mode)
    const mode = app.mode;
    if (!mode || mode.type !== 'edit') {
        console.error('[convertThinInstanceToMesh] Can only convert thin instances in Edit mode');
        return null;
    }

    const editMode = mode as unknown as EditMode;
    const newMesh = editMode.artist?.drawAtom(position, {
        element,
        name,
        radius
    });

    if (!newMesh) {
        console.error('[convertThinInstanceToMesh] Failed to create mesh via Artist');
        return null;
    }

    // Note: We don't remove the thin instance here because Babylon.js doesn't support
    // removing individual thin instances. Instead, we'll mark it as converted or
    // handle it during the next frame redraw.
    // For now, the thin instance will remain visible but the mesh will be on top.

    console.log(`[convertThinInstanceToMesh] Successfully converted to mesh: ${newMesh.name}`);

    return newMesh;
}

/**
 * Check if a mesh is a thin instance base mesh.
 * 
 * @param mesh The mesh to check
 * @returns True if the mesh is a thin instance base
 */
export function isThinInstanceMesh(mesh: Mesh): boolean {
    const metadata = mesh.metadata as MeshMetadata;
    return !!(metadata?.matrices && metadata?.atomCount);
}

/**
 * Get the thin instance index from a pick result.
 * 
 * @param mesh The picked mesh
 * @param thinInstanceIndex The thin instance index from the pick result
 * @returns The thin instance index, or -1 if not a thin instance
 */
export function getThinInstanceIndex(mesh: Mesh, thinInstanceIndex?: number): number {
    if (thinInstanceIndex === undefined || thinInstanceIndex === -1) {
        return -1;
    }

    if (!isThinInstanceMesh(mesh)) {
        return -1;
    }

    return thinInstanceIndex;
}
