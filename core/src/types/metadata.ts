
/**
 * Type definitions for Mesh Metadata used in MolVis.
 * Used to replace (mesh as any).metadata usage.
 */

export type MeshType = "atom" | "bond" | "box" | "frame";

export interface AtomMetadata {
    meshType: "atom";
    atomId: number;
    element: string;
    matrices?: Float32Array; // For thin instances
    names?: string[];        // For thin instances
    name?: string;           // For single atom name
}

export interface BondMetadata {
    meshType: "bond";
    bondId?: number;
    order?: number;
    atomId1?: number; // Start atom ID
    atomId2?: number; // End atom ID
    i?: number;       // Start atom index (block)
    j?: number;       // End atom index (block)
    // Position coordinates for manually created bonds
    x1?: number;
    y1?: number;
    z1?: number;
    x2?: number;
    y2?: number;
    z2?: number;
}

export interface BoxMetadata {
    meshType: "box";
}

export type MolvisMeshMetadata = AtomMetadata | BondMetadata | BoxMetadata | { meshType?: string;[key: string]: unknown };
