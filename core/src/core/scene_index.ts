import type { Mesh } from "@babylonjs/core";
import type { Block, Box } from "molrs-wasm";
import { Topology } from "./system/topology";

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
 * STRICT: Must include dimensions and origin.
 */
export interface BoxMeta {
    type: 'box';
    dimensions: [number, number, number];
    origin: [number, number, number];
}

/**
 * Union type for all entity metadata.
 */
export type EntityMeta = AtomMeta | BondMeta | BoxMeta;

// ============ Registration Options ============

/**
 * Options for registering a frame (View mode thin instances).
 */
export interface RegisterFrameOptions {
    atomMesh: Mesh;
    bondMesh?: Mesh;
    atomBlock: Block;
    bondBlock?: Block;
    box?: Box;
}

/**
 * Options for registering an individual atom (Edit mode).
 */
export interface RegisterAtomOptions {
    mesh: Mesh;
    meta: Omit<AtomMeta, 'type'>;
}

/**
 * Options for registering an individual bond (Edit mode).
 */
export interface RegisterBondOptions {
    mesh: Mesh;
    meta: Omit<BondMeta, 'type'>;
}

/**
 * Options for registering a simulation box.
 */
export interface RegisterBoxOptions {
    mesh: Mesh;
    meta: Omit<BoxMeta, 'type'>;
}

// ============ Internal Storage Types ============

/**
 * Renderable primitive instance handle.
 * Stores render-side references (Mesh, material, highlight, pick mapping).
 */
export interface MeshEntity {
    mesh: Mesh;
    material?: unknown;
    highlightRef?: unknown;
    pickKey?: string;
}

interface EntityEntryBase {
    isSaved: boolean;
}

export interface FrameAtomEntry extends EntityEntryBase {
    kind: 'frame-atom';
    atomBlock: Block;
}

export interface FrameBondEntry extends EntityEntryBase {
    kind: 'frame-bond';
    bondBlock: Block;
    atomBlock: Block;  // Need atom coords for bond positions
}

export interface StaticAtomEntry extends EntityEntryBase {
    kind: 'atom';
    meta: AtomMeta;
}

export interface StaticBondEntry extends EntityEntryBase {
    kind: 'bond';
    meta: BondMeta;
}

export interface BoxEntry extends EntityEntryBase {
    kind: 'box';
    meta: BoxMeta;
}

export type IndexEntry = FrameAtomEntry | FrameBondEntry | StaticAtomEntry | StaticBondEntry | BoxEntry;

// ============ SceneIndex ============

/**
 * SceneIndex: Single Truth for Entity Metadata.
 * 
 * Responsibilities:
 * - Maps render objects (Meshes) to business entities (Atoms, Bonds).
 * - Provides Chemistry-Semantic Metadata via `getMeta()`.
 * - Manages Molecular Topology (Connectivity).
 * 
 * Strict Mode:
 * - No fallbacks for malformed data.
 * - Enforces valid IDs and indices.
 */
export class SceneIndex {
    private meshRegistry = new Map<number, MeshEntity>();
    private entityRegistry = new Map<number, IndexEntry>();
    private allUnsaved = false;

    /**
     * Get read-only iterator for all entries
     */
    get allEntries(): ReadonlyMap<number, IndexEntry> {
        return this.entityRegistry;
    }

    /**
     * Get Mesh for a registered mesh ID.
     */
    getMesh(meshId: number): Mesh | null {
        return this.meshRegistry.get(meshId)?.mesh ?? null;
    }

    /**
     * Get MeshEntity for a registered mesh ID.
     */
    getMeshEntity(meshId: number): MeshEntity | null {
        return this.meshRegistry.get(meshId) ?? null;
    }

    /**
     * Generate next safe atom ID (unified semantic ID)
     * Scans existing atoms (frame and static) to find max ID.
     */
    getNextAtomId(): number {
        let maxId = -1;
        for (const entry of this.entityRegistry.values()) {
            if (entry.kind === 'atom') {
                maxId = Math.max(maxId, entry.meta.atomId);
            } else if (entry.kind === 'frame-atom') {
                maxId = Math.max(maxId, entry.atomBlock.nrows() - 1);
            }
        }
        return maxId + 1;
    }

    public topology: Topology = new Topology();

    // ============ Registration APIs ============

    /**
     * Register a frame (View mode) with thin instances atoms and bonds.
     */
    registerFrame(options: RegisterFrameOptions): void {
        const { atomMesh, bondMesh, atomBlock, bondBlock } = options;

        // Register atom mesh
        if (!atomBlock) throw new Error("SceneIndex: atomBlock is required for frame registration");

        this.meshRegistry.set(atomMesh.uniqueId, { mesh: atomMesh });
        this.entityRegistry.set(atomMesh.uniqueId, {
            kind: 'frame-atom',
            atomBlock,
            isSaved: true
        });
        this.allUnsaved = false;

        // Register atoms to topology
        const atomCount = atomBlock.nrows();
        for (let i = 0; i < atomCount; i++) {
            this.topology.addAtom(i);
        }

        // Register bond mesh if present
        if (bondMesh && bondBlock) {
            this.meshRegistry.set(bondMesh.uniqueId, { mesh: bondMesh });
            this.entityRegistry.set(bondMesh.uniqueId, {
                kind: 'frame-bond',
                bondBlock,
                atomBlock,  // Store for position lookup
                isSaved: true
            });

            // Register bonds to topology
            const bondCount = bondBlock.nrows();
            const iAtoms = bondBlock.col_u32('i')!;
            const jAtoms = bondBlock.col_u32('j')!;

            for (let b = 0; b < bondCount; b++) {
                this.topology.addBond(b, iAtoms[b], jAtoms[b]);
            }
        }
    }

    /**
     * Register an individual atom (Edit mode).
     */
    registerAtom(options: RegisterAtomOptions): void {
        this.meshRegistry.set(options.mesh.uniqueId, { mesh: options.mesh });
        this.entityRegistry.set(options.mesh.uniqueId, {
            kind: 'atom',
            meta: { type: 'atom', ...options.meta },
            isSaved: false
        });
        this.topology.addAtom(options.meta.atomId);
        this.markAllUnsaved();
    }

    /**
     * Register an individual bond (Edit mode).
     */
    registerBond(options: RegisterBondOptions): void {
        this.meshRegistry.set(options.mesh.uniqueId, { mesh: options.mesh });
        this.entityRegistry.set(options.mesh.uniqueId, {
            kind: 'bond',
            meta: { type: 'bond', ...options.meta },
            isSaved: false
        });
        this.topology.addBond(
            options.meta.bondId,
            options.meta.atomId1,
            options.meta.atomId2
        );
        this.markAllUnsaved();
    }

    /**
     * Register a simulation box.
     */
    registerBox(options: RegisterBoxOptions): void {
        this.meshRegistry.set(options.mesh.uniqueId, { mesh: options.mesh });
        this.entityRegistry.set(options.mesh.uniqueId, {
            kind: 'box',
            meta: { type: 'box', ...options.meta },
            isSaved: false
        });
        this.markAllUnsaved();
    }

    /**
     * Register a simulation box sourced from a Frame.
     */
    registerBoxFromFrame(mesh: Mesh, meta: Omit<BoxMeta, 'type'>): void {
        this.meshRegistry.set(mesh.uniqueId, { mesh });
        this.entityRegistry.set(mesh.uniqueId, {
            kind: 'box',
            meta: { type: 'box', ...meta },
            isSaved: true
        });
        this.allUnsaved = false;
    }

    // ============ Query APIs ============

    /**
     * Get entity type for a mesh.
     * 
     * @param meshId - The mesh's uniqueId
     * @returns 'atom' | 'bond' | 'box' | null
     */
    getType(meshId: number): EntityType | null {
        const entry = this.entityRegistry.get(meshId);
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
        const entry = this.entityRegistry.get(meshId);
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
        if (subIndex === undefined || subIndex < 0) return null;

        const { atomBlock } = entry;
        const count = atomBlock.nrows();
        if (subIndex >= count) return null;

        const xCoords = atomBlock.col_f32('x');
        const yCoords = atomBlock.col_f32('y');
        const zCoords = atomBlock.col_f32('z');
        const elements = atomBlock.col_strings('element');

        if (!xCoords || !yCoords || !zCoords || !elements) return null;

        // Valid data found
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
        const entry = this.entityRegistry.get(meshId);
        if (!entry) return;

        // Cleanup topology based on entry type
        if (entry.kind === 'atom') {
            this.topology.removeAtom(entry.meta.atomId);
        } else if (entry.kind === 'bond') {
            this.topology.removeBond(entry.meta.bondId);
        } else if (entry.kind === 'frame-atom') {
            const count = entry.atomBlock.nrows();
            for (let i = 0; i < count; i++) {
                this.topology.removeAtom(i);
            }
        } else if (entry.kind === 'frame-bond') {
            const count = entry.bondBlock.nrows();
            for (let b = 0; b < count; b++) {
                this.topology.removeBond(b);
            }
        }

        this.entityRegistry.delete(meshId);
        this.meshRegistry.delete(meshId);
    }

    /**
     * Clear all registrations.
     */
    clear(): void {
        this.entityRegistry.clear();
        this.meshRegistry.clear();
        this.topology.clear();
        this.allUnsaved = false;
    }

    // ============ Saved State APIs ============

    /**
     * Check saved state for a specific mesh ID.
     */
    isSaved(meshId: number): boolean | null {
        const entry = this.entityRegistry.get(meshId);
        return entry ? entry.isSaved : null;
    }

    /**
     * Check if any entities are unsaved.
     */
    hasUnsaved(): boolean {
        if (this.allUnsaved) {
            return this.entityRegistry.size > 0;
        }
        for (const entry of this.entityRegistry.values()) {
            if (!entry.isSaved) return true;
        }
        return false;
    }

    /**
     * Mark a specific entity as unsaved.
     */
    markUnsaved(meshId: number): void {
        const entry = this.entityRegistry.get(meshId);
        if (entry) {
            entry.isSaved = false;
        }
    }

    /**
     * Mark all entities as unsaved.
     */
    markAllUnsaved(): void {
        if (this.allUnsaved) return;
        for (const entry of this.entityRegistry.values()) {
            entry.isSaved = false;
        }
        this.allUnsaved = true;
    }

    /**
     * Mark all entities as saved.
     */
    markAllSaved(): void {
        for (const entry of this.entityRegistry.values()) {
            entry.isSaved = true;
        }
        this.allUnsaved = false;
    }
}
