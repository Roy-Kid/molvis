import type { Block } from "@molcrafts/molrs";

// ============ Entity Types ============

export type EntityType = "atom" | "bond" | "box";

// ============ Meta Types ============

export interface AtomMeta {
  type: "atom";
  atomId: number;
  element: string;
  position: { x: number; y: number; z: number };
}

export interface BondMeta {
  type: "bond";
  bondId: number;
  atomId1: number;
  atomId2: number;
  order: number;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
}

export interface BoxMeta {
  type: "box";
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
  setAttribute(id: number, key: string, value: unknown) {
    let meta = this.edits.get(id);
    if (!meta) {
      const base = this.getFromFrame(id);
      if (!base) return;
      meta = { ...base };
      this.edits.set(id, meta);
    }
    if (key === "x" || key === "y" || key === "z") {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        throw new Error(`Invalid coordinate value for atom ${id}.${key}`);
      }
      meta.position[key] = numericValue;
      return;
    }

    (meta as unknown as Record<string, unknown>)[key] = value;
  }

  /**
   * Get a specific attribute value.
   */
  getAttribute(id: number, key: string): unknown {
    const edit = this.edits.get(id);
    if (edit) {
      if (key === "x") return edit.position.x;
      if (key === "y") return edit.position.y;
      if (key === "z") return edit.position.z;
      if (key in edit) {
        return (edit as unknown as Record<string, unknown>)[key];
      }
    }

    if (this.frameBlock && id < this.frameBlock.nrows()) {
      if (key === "x" || key === "y" || key === "z") {
        const col = this.frameBlock.getColumnF32(key);
        if (col) return col[id];
      }
      if (key === "element") {
        const col = this.frameBlock.getColumnStrings(key);
        if (col) return col[id];
      }
      const col = this.frameBlock.getColumnF32(key);
      if (col) return col[id];
      const strCol = this.frameBlock.getColumnStrings(key);
      if (strCol) return strCol[id];
    }
    return undefined;
  }

  getMeta(id: number): AtomMeta | null {
    const edit = this.edits.get(id);
    if (edit) return edit;

    if (this.frameBlock && id < this.frameBlock.nrows()) {
      return this.getFromFrame(id);
    }
    return null;
  }

  private getFromFrame(index: number): AtomMeta | null {
    if (!this.frameBlock) return null;

    const x = this.frameBlock.getColumnF32("x");
    const y = this.frameBlock.getColumnF32("y");
    const z = this.frameBlock.getColumnF32("z");
    const elements = this.frameBlock.getColumnStrings("element");

    if (!x || !y || !z || !elements) return null;

    return {
      type: "atom",
      atomId: index,
      element: elements[index],
      position: { x: x[index], y: y[index], z: z[index] },
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
    // Yield all frame IDs (0..frameCount-1), whether overridden by edits or not
    if (this.frameBlock) {
      const count = this.frameBlock.nrows();
      for (let i = 0; i < count; i++) {
        yield i;
      }
    }
    // Yield edit-only IDs that are outside the frame range
    const frameCount = this.frameBlock?.nrows() ?? 0;
    for (const id of this.edits.keys()) {
      if (id >= frameCount) {
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

  setAttribute(id: number, key: string, value: unknown) {
    let meta = this.edits.get(id);
    if (!meta) {
      const base = this.getFromFrame(id);
      if (!base) return;
      meta = { ...base };
      this.edits.set(id, meta);
    }
    (meta as unknown as Record<string, unknown>)[key] = value;
  }

  getAttribute(id: number, key: string): unknown {
    const edit = this.edits.get(id);
    if (edit && key in edit) {
      return (edit as unknown as Record<string, unknown>)[key];
    }

    if (this.frameBlock && id < this.frameBlock.nrows()) {
      if (key === "order") {
        const col = this.frameBlock.getColumnU8("order");
        if (col) return col[id];
      }
      const col = this.frameBlock.getColumnF32(key);
      if (col) return col[id];
      const strCol = this.frameBlock.getColumnStrings(key);
      if (strCol) return strCol[id];
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

    const iAtoms = this.frameBlock.getColumnU32("i");
    const jAtoms = this.frameBlock.getColumnU32("j");
    const orders = this.frameBlock.getColumnU8("order");

    const ax = this.atomBlock.getColumnF32("x");
    const ay = this.atomBlock.getColumnF32("y");
    const az = this.atomBlock.getColumnF32("z");

    if (!iAtoms || !jAtoms || !ax || !ay || !az) return null;

    const i = iAtoms[index];
    const j = jAtoms[index];

    return {
      type: "bond",
      bondId: index,
      atomId1: i,
      atomId2: j,
      order: orders ? orders[index] : 1,
      start: { x: ax[i], y: ay[i], z: az[i] },
      end: { x: ax[j], y: ay[j], z: az[j] },
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
        yield i;
      }
    }
    const frameCount = this.frameBlock?.nrows() ?? 0;
    for (const id of this.edits.keys()) {
      if (id >= frameCount) {
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
