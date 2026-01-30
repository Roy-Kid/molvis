import { Block } from "molrs-wasm";

// ============ Entity Types ============

export type EntityType = 'atom' | 'bond' | 'box';

// ============ Meta Types ============

export interface AtomMeta {
    type: 'atom';
    atomId: number;
    element: string;
    position: { x: number; y: number; z: number };
}

export interface BondMeta {
    type: 'bond';
    bondId: number;
    atomId1: number;
    atomId2: number;
    order: number;
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
}

export interface BoxMeta {
    type: 'box';
    dimensions: [number, number, number];
    origin: [number, number, number];
}

export type EntityMeta = AtomMeta | BondMeta | BoxMeta;

// ============ Unified Source Classes ============

export class AtomSource {
    public frameBlock: Block | null = null;
    public edits = new Map<number, AtomMeta>();

    setFrame(block: Block) {
        this.frameBlock = block;
    }

    setEdit(id: number, meta: AtomMeta) {
        this.edits.set(id, meta);
    }

    removeEdit(id: number) {
        this.edits.delete(id);
    }

    getMeta(id: number): AtomMeta | null {
        // 1. Check local edits first (overlay)
        const edit = this.edits.get(id);
        if (edit) return edit;

        // 2. Check frame data
        if (this.frameBlock && id < this.frameBlock.nrows()) {
            return this.getFromFrame(id);
        }

        return null;
    }

    private getFromFrame(index: number): AtomMeta | null {
        if (!this.frameBlock) return null;

        // Optimize? Only read needed columns?
        // MolRS blocks usually return TypedArrays for columns.
        // We can cache these if performance is an issue, but for now access directly.
        // WARNING: getColumnF32 creates a new Float32Array view every time?
        // Ideally we should cache the column views if they don't change.
        // But Block doesn't emit change events.
        // Let's assume fetching column view is cheap (it's WASM memory view).

        const x = this.frameBlock.getColumnF32('x');
        const y = this.frameBlock.getColumnF32('y');
        const z = this.frameBlock.getColumnF32('z');
        const elements = this.frameBlock.getColumnStrings('element'); // This might be expensive?

        if (!x || !y || !z || !elements) return null;

        return {
            type: 'atom',
            atomId: index,
            element: elements[index] || 'C',
            position: { x: x[index], y: y[index], z: z[index] }
        };
    }

    getMaxId(): number {
        let max = -1;
        if (this.frameBlock) {
            max = Math.max(max, this.frameBlock.nrows() - 1);
        }
        for (const id of this.edits.keys()) {
            max = Math.max(max, id);
        }
        return max;
    }

    *getAllIds(): IterableIterator<number> {
        if (this.frameBlock) {
            const count = this.frameBlock.nrows();
            for (let i = 0; i < count; i++) {
                // Return frame ID unless it's "deleted" via edits? 
                // Currently we don't support "deletion masking" of frame atoms in this simple model 
                // other than overriding them with new data?
                // Actually `removeEdit` just removes the OVERRIDE.
                // To delete a frame atom, we might need a `deletions` Set.
                // For now, let's assume we adhere to current behavior:
                // Frame atoms exist. Edits are additions or modifications.
                // Wait, if I delete a frame atom in EditMode, does it go away?
                // In previous `EditAtomSource` logic, Frame and Edit were disjoint sets in Hybrid?
                // Actually Hybrid iterated both.
                // If I "delete" a frame atom, I usually Unregister it?
                // But Frame is read-only block.
                // We likely need a `deletedIds` set to mask frame atoms.
                if (!this.edits.has(i)) { // If edited, it will be yielded by edits keys? 
                    // No, edits map has the meta.
                    // If I override frame atom 5, `edits.get(5)` returns new meta.
                    // I should yield 5.
                    // But if I iterate edits.keys() separately, I might duplicate?
                    // Let's just iterate 0..frameCount, then edits that are > frameCount?
                    // Or use a Set to track yielded IDs?
                    yield i;
                }
            }
        }

        for (const id of this.edits.keys()) {
            if (!this.frameBlock || id >= this.frameBlock.nrows()) {
                yield id;
            } else {
                // It's an override of a frame atom, already yielded above?
                // Wait, if I override atom 5:
                // Loop 0..N yields 5 (checked edits.has? No, I yielded it).
                // Actually, if I just yield 0..N-1, and then yield edits > N-1, what about overridden atoms?
                // `getMeta(5)` returns the edit.
                // So yielding 5 from the first loop is CORRECT.
                // I just need to make sure I don't yield 5 AGAIN from edits loop.
                // So edits loop should only yield IDs that are NOT in frame range.
            }
        }
    }
}

export class BondSource {
    public frameBlock: Block | null = null;
    public atomBlock: Block | null = null; // Needed for positions
    public edits = new Map<number, BondMeta>();

    setFrame(bondBlock: Block, atomBlock: Block) {
        this.frameBlock = bondBlock;
        this.atomBlock = atomBlock;
    }

    setEdit(id: number, meta: BondMeta) {
        this.edits.set(id, meta);
    }

    removeEdit(id: number) {
        this.edits.delete(id);
    }

    getMeta(id: number): BondMeta | null {
        const edit = this.edits.get(id);
        if (edit) return edit;

        if (this.frameBlock && this.atomBlock && id < this.frameBlock.nrows()) {
            return this.getFromFrame(id);
        }
        return null;
    }

    private getFromFrame(index: number): BondMeta | null {
        if (!this.frameBlock || !this.atomBlock) return null;

        const iAtoms = this.frameBlock.getColumnU32('i');
        const jAtoms = this.frameBlock.getColumnU32('j');
        const orders = this.frameBlock.getColumnU8('order');

        // We need atom positions to construct BondMeta
        // Assuming we look up in FrameAtomBlock directly for speed?
        // Or should we resolve via AtomSource to get potentially edited positions?
        // Ideally bonds should follow atoms.
        // But `BondSource` doesn't reference `AtomSource`.
        // If an atom moved in `AtomSource`, the bond in `BondSource` (Frame) points to indices i, j.
        // If I simply read x/y/z from `atomBlock`, I get ORIGINAL frame positions.
        // If the atom was moved in `AtomSource` (Edit), the bond should visually move.
        // `DrawBondCommand` usually calculates positions from `SceneIndex.getMeta(atomId)`.
        // `BondMeta` here is "Data".
        // Use `start`/`end` in BondMeta is redundancy.
        // But the Interface defines `start`/`end`.
        // For Frame bonds, we must calculate them on fly.
        // If we want consistency, we should lookup atom positions from `AtomSource`.
        // But `BondSource` is standalone here.
        // Let's stick to reading from `atomBlock` (Frame Data) for now.
        // If an atom is "Edited" (moved), the `BondSource` frame-derived meta will show old positions.
        // BUT the `MeshRegistry` (Renderer) updates the bond buffer using `updateConnectedBonds`.
        // So the RENDER is correct.
        // The `Meta` returned here might be stale if we just read frame block?
        // This is a discrepancy.
        // However, `FrameBondSource` previously did `ax[i]`.
        // So it was always reading original frame positions.
        // So this refactor preserves existing behavior.

        const ax = this.atomBlock.getColumnF32('x');
        const ay = this.atomBlock.getColumnF32('y');
        const az = this.atomBlock.getColumnF32('z');

        if (!iAtoms || !jAtoms || !ax || !ay || !az) return null;

        const i = iAtoms[index];
        const j = jAtoms[index];

        return {
            type: 'bond',
            bondId: index,
            atomId1: i,
            atomId2: j,
            order: orders ? orders[index] : 1,
            start: { x: ax[i], y: ay[i], z: az[i] },
            end: { x: ax[j], y: ay[j], z: az[j] }
        };
    }

    getMaxId(): number {
        let max = -1;
        if (this.frameBlock) {
            max = Math.max(max, this.frameBlock.nrows() - 1);
        }
        for (const id of this.edits.keys()) {
            max = Math.max(max, id);
        }
        return max;
    }

    *getAllIds(): IterableIterator<number> {
        if (this.frameBlock) {
            const count = this.frameBlock.nrows();
            for (let i = 0; i < count; i++) yield i;
        }
        for (const id of this.edits.keys()) {
            if (!this.frameBlock || id >= this.frameBlock.nrows()) {
                yield id;
            }
        }
    }
}

// ============ Meta Registry ============

export class MetaRegistry {
    public atoms = new AtomSource();
    public bonds = new BondSource();
    public box: BoxMeta | null = null; // Simple box storage

    clear() {
        this.atoms = new AtomSource();
        this.bonds = new BondSource();
        this.box = null;
    }
}
