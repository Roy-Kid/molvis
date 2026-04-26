import type { Block, Frame } from "@molcrafts/molrs";
import { viewAtomCoords } from "./io/atom_coords";
import { DType } from "./utils/dtype";

// ============ Entity Types ============

export type EntityType = "atom" | "bond" | "box";

// ============ Meta Types ============

export interface AtomMeta {
  type: "atom";
  atomId: number;
  /** Element symbol from the frame's `element` column. `""` when absent. */
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
  private _frame: Frame | null = null;
  public edits = new Map<number, AtomMeta>();

  /**
   * Bind this source to a Frame. Block handles are fetched lazily via the
   * `frameBlock` getter so that any WASM-side version bumps (e.g. the
   * conservative bump that `with_frame_mut` applies when meta/grids are
   * mutated) never leave us holding a stale handle.
   */
  setFrame(frame: Frame | null) {
    this._frame = frame;
  }

  /** Current atoms block for the bound frame, or null if no frame is bound. */
  get frameBlock(): Block | null {
    return this._frame?.getBlock("atoms") ?? null;
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
        const coords = viewAtomCoords(this.frameBlock);
        const col = coords?.[key];
        if (col) return col[id];
      }
      if (key === "element") {
        const col = this.frameBlock.copyColStr(key);
        if (col) return col[id];
      }
      const col =
        this.frameBlock.dtype(key) === DType.F64
          ? this.frameBlock.viewColF(key)
          : undefined;
      if (col) return col[id];
      const strCol =
        this.frameBlock.dtype(key) === DType.String
          ? this.frameBlock.copyColStr(key)
          : undefined;
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

    const coords = viewAtomCoords(this.frameBlock);
    const x = coords?.x;
    const y = coords?.y;
    const z = coords?.z;

    if (!x || !y || !z) return null;

    // Canonical convention: `element` is String when present, absent otherwise.
    const elements =
      this.frameBlock.dtype("element") === DType.String
        ? this.frameBlock.copyColStr("element")
        : undefined;

    return {
      type: "atom",
      atomId: index,
      element: elements?.[index] ?? "",
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
  private _frame: Frame | null = null;
  public edits = new Map<number, BondMeta>();

  /**
   * Bind this source to a Frame. The bonds and atoms blocks are fetched
   * lazily via getters so WASM-side handle-version bumps never leave us
   * holding a stale reference.
   */
  setFrame(frame: Frame | null) {
    this._frame = frame;
  }

  /** Current bonds block for the bound frame, or null if absent. */
  get frameBlock(): Block | null {
    return this._frame?.getBlock("bonds") ?? null;
  }

  /** Current atoms block (needed for bond endpoint positions). */
  get atomBlock(): Block | null {
    return this._frame?.getBlock("atoms") ?? null;
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
        const col =
          this.frameBlock.dtype(key) === DType.U32
            ? this.frameBlock.viewColU32(key)
            : undefined;
        if (col) return col[id];
      }
      const col =
        this.frameBlock.dtype(key) === DType.F64
          ? this.frameBlock.viewColF(key)
          : undefined;
      if (col) return col[id];
      const strCol =
        this.frameBlock.dtype(key) === DType.String
          ? this.frameBlock.copyColStr(key)
          : undefined;
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

    const iAtoms = this.frameBlock.viewColU32("atomi");
    const jAtoms = this.frameBlock.viewColU32("atomj");
    const orders =
      this.frameBlock.dtype("order") === DType.U32
        ? this.frameBlock.viewColU32("order")
        : undefined;

    const coords = viewAtomCoords(this.atomBlock);
    const ax = coords?.x;
    const ay = coords?.y;
    const az = coords?.z;

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
