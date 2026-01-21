import type { Block, Box } from "molrs-wasm";

// ============ Entity Types ============

export type EntityType = 'atom' | 'bond' | 'box';

// ============ Meta Types ============

/**
 * Metadata for an atom entity.
 */
export interface AtomMeta {
    type: 'atom';
    atomId: number;
    element: string;
    position: { x: number; y: number; z: number };
}

/**
 * Metadata for a bond entity.
 */
export interface BondMeta {
    type: 'bond';
    bondId: number;
    atomId1: number;
    atomId2: number;
    order: number;
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
}

/**
 * Metadata for a simulation box.
 */
export interface BoxMeta {
    type: 'box';
    dimensions: [number, number, number];
}

/**
 * Union type for all entity metadata.
 */
export type EntityMeta = AtomMeta | BondMeta | BoxMeta;

// ============ Registration Options ============

/**
 * Duck-typed mesh reference (Babylon decoupled).
 */
export interface MeshRef {
    uniqueId: number;
}

/**
 * Options for registering a frame (View mode thin instances).
 */
export interface RegisterFrameOptions {
    atomMesh: MeshRef;
    bondMesh?: MeshRef;
    atomBlock: Block;
    bondBlock?: Block;
    box?: Box;
}

/**
 * Options for registering an individual atom (Edit mode).
 */
export interface RegisterAtomOptions {
    mesh: MeshRef;
    meta: Omit<AtomMeta, 'type'>;
}

/**
 * Options for registering an individual bond (Edit mode).
 */
export interface RegisterBondOptions {
    mesh: MeshRef;
    meta: Omit<BondMeta, 'type'>;
}

/**
 * Options for registering a simulation box.
 */
export interface RegisterBoxOptions {
    mesh: MeshRef;
    meta: Omit<BoxMeta, 'type'>;
}

// ============ Internal Storage Types ============

interface FrameAtomEntry {
    kind: 'frame-atom';
    atomBlock: Block;
}

interface FrameBondEntry {
    kind: 'frame-bond';
    bondBlock: Block;
    atomBlock: Block;  // Need atom coords for bond positions
}

interface StaticAtomEntry {
    kind: 'atom';
    meta: AtomMeta;
}

interface StaticBondEntry {
    kind: 'bond';
    meta: BondMeta;
}

interface BoxEntry {
    kind: 'box';
    meta: BoxMeta;
}

type IndexEntry = FrameAtomEntry | FrameBondEntry | StaticAtomEntry | StaticBondEntry | BoxEntry;

// ============ SceneIndex ============

/**
 * SceneIndex: Pure index service mapping render objects to business metadata.
 * 
 * Responsibilities:
 * - Register entities with chemistry-semantic APIs (registerFrame, registerAtom, registerBond, registerBox)
 * - Query metadata via getMeta(meshId, subIndex?)
 * - Lifecycle management (unregister, clear)
 * 
 * Does NOT:
 * - Handle picking logic or events
 * - Manage selection/highlight state
 * - Know about Babylon types (accepts duck-typed MeshRef)
 */
export class SceneIndex {
    private entries = new Map<number, IndexEntry>();

    // ============ Registration APIs ============

    /**
     * Register a frame (View mode) with thin instance atoms and bonds.
     */
    registerFrame(options: RegisterFrameOptions): void {
        const { atomMesh, bondMesh, atomBlock, bondBlock } = options;

        // Register atom mesh
        this.entries.set(atomMesh.uniqueId, {
            kind: 'frame-atom',
            atomBlock
        });

        // Register bond mesh if present
        if (bondMesh && bondBlock) {
            this.entries.set(bondMesh.uniqueId, {
                kind: 'frame-bond',
                bondBlock,
                atomBlock  // Store for position lookup
            });
        }
    }

    /**
     * Register an individual atom (Edit mode).
     */
    registerAtom(options: RegisterAtomOptions): void {
        this.entries.set(options.mesh.uniqueId, {
            kind: 'atom',
            meta: { type: 'atom', ...options.meta }
        });
    }

    /**
     * Register an individual bond (Edit mode).
     */
    registerBond(options: RegisterBondOptions): void {
        this.entries.set(options.mesh.uniqueId, {
            kind: 'bond',
            meta: { type: 'bond', ...options.meta }
        });
    }

    /**
     * Register a simulation box.
     */
    registerBox(options: RegisterBoxOptions): void {
        this.entries.set(options.mesh.uniqueId, {
            kind: 'box',
            meta: { type: 'box', ...options.meta }
        });
    }

    // ============ Query APIs ============

    /**
     * Get entity type for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @returns 'atom', 'bond', or 'box', or null if not registered
     */
    getType(meshId: number): EntityType | null {
        const entry = this.entries.get(meshId);
        if (!entry) return null;

        switch (entry.kind) {
            case 'frame-atom':
            case 'atom':
                return 'atom';
            case 'frame-bond':
            case 'bond':
                return 'bond';
            case 'box':
                return 'box';
        }
    }

    /**
     * Get metadata for a mesh, optionally with thin instance subIndex.
     * 
     * @param meshId - The mesh's uniqueId
     * @param subIndex - Optional thin instance index
     * @returns EntityMeta or null if not found/invalid
     */
    getMeta(meshId: number, subIndex?: number): EntityMeta | null {
        const entry = this.entries.get(meshId);
        if (!entry) return null;

        switch (entry.kind) {
            case 'frame-atom':
                return this.getFrameAtomMeta(entry, subIndex);
            case 'frame-bond':
                return this.getFrameBondMeta(entry, subIndex);
            case 'atom':
                return entry.meta;
            case 'bond':
                return entry.meta;
            case 'box':
                return entry.meta;
        }
    }

    private getFrameAtomMeta(entry: FrameAtomEntry, subIndex?: number): AtomMeta | null {
        if (subIndex === undefined) return null;

        const { atomBlock } = entry;
        const count = atomBlock.nrows();
        if (subIndex < 0 || subIndex >= count) return null;

        const xCoords = atomBlock.col_f32('x');
        const yCoords = atomBlock.col_f32('y');
        const zCoords = atomBlock.col_f32('z');
        const elements = atomBlock.col_strings('element');

        if (!xCoords || !yCoords || !zCoords || !elements) return null;

        return {
            type: 'atom',
            atomId: subIndex,
            element: elements[subIndex] || 'C',
            position: {
                x: xCoords[subIndex],
                y: yCoords[subIndex],
                z: zCoords[subIndex]
            }
        };
    }

    private getFrameBondMeta(entry: FrameBondEntry, subIndex?: number): BondMeta | null {
        if (subIndex === undefined) return null;

        const { bondBlock, atomBlock } = entry;
        const count = bondBlock.nrows();
        if (subIndex < 0 || subIndex >= count) return null;

        const iAtoms = bondBlock.col_u32('i');
        const jAtoms = bondBlock.col_u32('j');
        const orders = bondBlock.col_u8('order');

        const xCoords = atomBlock.col_f32('x');
        const yCoords = atomBlock.col_f32('y');
        const zCoords = atomBlock.col_f32('z');

        if (!iAtoms || !jAtoms || !xCoords || !yCoords || !zCoords) return null;

        const i = iAtoms[subIndex];
        const j = jAtoms[subIndex];

        return {
            type: 'bond',
            bondId: subIndex,
            atomId1: i,
            atomId2: j,
            order: orders ? orders[subIndex] : 1,
            start: {
                x: xCoords[i],
                y: yCoords[i],
                z: zCoords[i]
            },
            end: {
                x: xCoords[j],
                y: yCoords[j],
                z: zCoords[j]
            }
        };
    }

    // ============ Lifecycle APIs ============

    /**
     * Unregister a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     */
    unregister(meshId: number): void {
        this.entries.delete(meshId);
    }

    /**
     * Clear all registrations.
     */
    clear(): void {
        this.entries.clear();
    }
}
