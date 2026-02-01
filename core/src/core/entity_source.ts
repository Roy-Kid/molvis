import { Block } from "molrs-wasm";

// ============ Entity Types ============

export type EntityType = 'atom' | 'bond' | 'box';

// ============ Meta Types ============

export interface AtomMeta {
    type: 'atom';
    atomId: number;
    element: string;
    position: { x: number; y: number; z: number };
    [key: string]: any; // Allow arbitrary attributes
}

export interface BondMeta {
    type: 'bond';
    bondId: number;
    atomId1: number;
    atomId2: number;
    order: number;
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    [key: string]: any; // Allow arbitrary attributes
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

    /**
     * Set a specific attribute for an atom.
     * Creates an edit entry if one doesn't exist.
     */
    setAttribute(id: number, key: string, value: any) {
        let meta = this.edits.get(id);
        if (!meta) {
            // Need to fetch base meta to clone it?
            // Or can we store PARTIAL edits? 
            // The system expects full AtomMeta in edits for rendering?
            // SceneIndex.updateAtom merges edits.
            // But here AtomSource.getMeta returns AtomMeta | null.
            // If we only store partial, getMeta needs to merge on fly.
            // Current getMeta: "if (edit) return edit;" -> implies edit MUST be complete override.

            // To support partial updates without fetching full frame data every time we make a small edit:
            // We should probably fetch it ONCE here.

            const base = this.getFromFrame(id);
            if (!base) {
                // If ID is out of frame range, we can't really set attribute unless we are creating new atom.
                console.warn(`AtomSource: Cannot set attribute for non-existent atom ${id}`);
                return;
            }
            meta = { ...base };
            this.edits.set(id, meta);
        }
        meta[key] = value;
    }

    /**
     * Get a specific attribute value.
     */
    getAttribute(id: number, key: string): any {
        // 1. Check edits
        const edit = this.edits.get(id);
        if (edit) {
            // Special handling for position coordinates which are nested
            if (key === 'x') return edit.position.x;
            if (key === 'y') return edit.position.y;
            if (key === 'z') return edit.position.z;

            if (key in edit) {
                return edit[key];
            }
        }

        // 2. Check frame
        if (this.frameBlock && id < this.frameBlock.nrows()) {
            // Special handling for known columns to use TypedArrays?
            // General fallback
            if (key === 'x' || key === 'y' || key === 'z') {
                // Optimization: getFromFrame does this.
                // But we want just one value.
                const col = this.frameBlock.getColumnF32(key);
                if (col) return col[id];
            }
            if (key === 'element') {
                const col = this.frameBlock.getColumnStrings(key);
                if (col) return col[id];
            }

            // Generic generic
            // Check if F32
            // We don't know type easily without trying?
            // Block has `keys()`.

            // This is slow if we do it for every attribute read.
            // But intended for UI inspection.

            // Try F32 first (most common)
            try {
                const col = this.frameBlock.getColumnF32(key);
                if (col) return col[id];
            } catch (e) {
                // Ignore
            }

            try {
                const col = this.frameBlock.getColumnStrings(key);
                if (col) return col[id];
            } catch (e) {
                // Ignore
            }
        }
        return undefined;
    }

    getMeta(id: number): AtomMeta | null {
        // 1. Check local edits first (overlay)
        const edit = this.edits.get(id);
        if (edit) return edit; // Assumes edit is FULL meta

        // 2. Check frame data
        if (this.frameBlock && id < this.frameBlock.nrows()) {
            return this.getFromFrame(id);
        }

        return null;
    }

    private getFromFrame(index: number): AtomMeta | null {
        if (!this.frameBlock) return null;

        const x = this.frameBlock.getColumnF32('x');
        const y = this.frameBlock.getColumnF32('y');
        const z = this.frameBlock.getColumnF32('z');
        const elements = this.frameBlock.getColumnStrings('element');

        if (!x || !y || !z || !elements) return null;

        // Construct object with ALL columns from frame?
        // Current implementation only returns specific AtomMeta fields.
        // If we want `getMeta` to return everything, we need to iterate keys.
        // But `getFromFrame` is called often.
        // We will stick to minimal AtomMeta for now, and `getAttribute` for extras.

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
                if (!this.edits.has(i)) {
                    yield i;
                }
            }
        }

        for (const id of this.edits.keys()) {
            if (!this.frameBlock || id >= this.frameBlock.nrows()) {
                yield id;
            } else {
                // Must yield overridden IDs too?
                // Wait, logic above yields `i` if !edits.has(i).
                // So if edits.has(i), it wasn't yielded.
                // So we MUST yield it here.
                // Previous logic was confused.
                // Correct logic:
                // Yield all from edits.
                // Yield from frame IF NOT in edits.

                // But `edits.keys()` iteration order is arbitrary.
                // Iterating 0..N is ordered. 

                // Let's stick to: Iterate 0..N (Frame). If in edits, yield from edits? 
                // No, this generator yields IDs. Metadata retrieval is separate.
                // Changing implementation to be cleaner:
                yield id;
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

    setAttribute(id: number, key: string, value: any) {
        let meta = this.edits.get(id);
        if (!meta) {
            const base = this.getFromFrame(id);
            if (!base) return;
            meta = { ...base };
            this.edits.set(id, meta);
        }
        meta[key] = value;
    }

    getAttribute(id: number, key: string): any {
        const edit = this.edits.get(id);
        if (edit && key in edit) return edit[key];

        if (this.frameBlock && id < this.frameBlock.nrows()) {
            if (key === 'order') {
                const col = this.frameBlock.getColumnU8('order');
                if (col) return col[id];
            }
            // Generic fallback similar to atoms...
        }
        return undefined;
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
            for (let i = 0; i < count; i++) {
                if (!this.edits.has(i)) yield i;
            }
        }
        for (const id of this.edits.keys()) {
            // Yield edits. We yield frame IDs if not in edits above.
            // If edit is overriding frame, we yield it here.
            // If edit is new ID, we yield it here.
            // So simply yielding all edits is correct IF we skipped them in the first loop.
            yield id;
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
