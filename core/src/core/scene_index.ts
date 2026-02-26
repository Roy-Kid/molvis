import type { Mesh } from "@babylonjs/core";
import type { Block, Box } from "@molcrafts/molrs";
import {
  type AtomMeta,
  type BondMeta,
  type BoxMeta,
  type EntityMeta,
  type EntityType,
  MetaRegistry,
} from "./entity_source";
import { encodePickingColor } from "./picker";
import { makeSelectionKey } from "./selection_manager";
import { Topology } from "./system/topology";

// ============ Registration Options ============

export interface RegisterFrameOptions {
  atomMesh: Mesh;
  bondMesh?: Mesh;
  atomBlock: Block;
  bondBlock?: Block;
  box?: Box;
  atomBuffers?: Map<string, Float32Array>;
  bondBuffers?: Map<string, Float32Array>;
}

export interface RegisterAtomOptions {
  mesh: Mesh;
  meta: Omit<AtomMeta, "type">;
}

export interface RegisterBondOptions {
  mesh: Mesh;
  meta: Omit<BondMeta, "type">;
}

export interface RegisterBoxOptions {
  mesh: Mesh;
  meta: Omit<BoxMeta, "type">;
}

// ============ Impostor State ============

/**
 * Manages GPU buffers for thin instances in a unified buffer layout:
 * [0..frameOffset) = frame data, [frameOffset..frameOffset+count) = edit data.
 */
export class ImpostorState {
  public count = 0; // Number of EDIT atoms (added on top of frame)
  public capacity: number;
  public frameOffset = 0; // Number of FRAME atoms
  public dirty = false;

  public buffers = new Map<string, { data: Float32Array; stride: number }>();

  // Mapping for EDIT atoms only: ID -> EditIndex (0..count-1)
  public idToIndex = new Map<number, number>();
  public indexToId = new Map<number, number>();

  constructor(
    public mesh: Mesh,
    bufferDefs: Array<{ name: string; stride: number }>,
    initialCapacity = 64,
  ) {
    this.capacity = initialCapacity;
    for (const def of bufferDefs) {
      this.buffers.set(def.name, {
        data: new Float32Array(this.capacity * def.stride),
        stride: def.stride,
      });
    }
  }

  setFrameDataAndFlush(
    buffers: Map<string, Float32Array>,
    frameCount: number,
  ): void {
    this.frameOffset = frameCount;
    this.count = 0;
    this.idToIndex.clear();
    this.indexToId.clear();

    // 1. Ensure capacity
    if (this.capacity < frameCount) {
      this.capacity = Math.max(frameCount * 2, 64);
      for (const [_, desc] of this.buffers) {
        const newData = new Float32Array(this.capacity * desc.stride);
        desc.data = newData;
      }
    }

    for (const [name, data] of buffers) {
      const desc = this.buffers.get(name);
      if (desc) {
        desc.data.set(data.length <= desc.data.length ? data : data.subarray(0, desc.data.length));
      }
    }

    const pickBuf = this.buffers.get("instancePickingColor");
    if (pickBuf) {
      for (let i = 0; i < frameCount; i++) {
        const pCol = encodePickingColor(this.mesh.uniqueId, i);
        const offset = i * 4;
        pickBuf.data.set(pCol, offset);
      }
    }

    this.dirty = true;
    this.flush();
  }

  getStride(name: string): number {
    return this.buffers.get(name)?.stride ?? 4;
  }

  getIdByIndex(bufferIndex: number): number | undefined {
    // bufferIndex is absolute index.
    if (bufferIndex < this.frameOffset) return bufferIndex; // Implicit Frame ID

    const editIndex = bufferIndex - this.frameOffset;
    if (editIndex < 0 || editIndex >= this.count) return undefined;
    return this.indexToId.get(editIndex);
  }

  getIndex(id: number): number | undefined {
    if (id < this.frameOffset) return id; // Implicit Frame Index

    const editIndex = this.idToIndex.get(id);
    if (editIndex === undefined) return undefined;
    return editIndex + this.frameOffset;
  }

  append(id: number, values: Map<string, Float32Array | number[]>): number {
    if (this.idToIndex.has(id)) throw new Error(`Duplicate ID ${id}`);
    // Check total capacity (Frame + Edits)
    const totalNeeded = this.frameOffset + this.count + 1;
    if (totalNeeded > this.capacity) this.grow();

    const editIndex = this.count;
    const absIndex = this.frameOffset + editIndex;

    for (const [name, desc] of this.buffers) {
      const vals = values.get(name);
      if (vals) {
        const arr =
          vals instanceof Float32Array ? vals : new Float32Array(vals);
        desc.data.set(arr, absIndex * desc.stride);
      }
    }

    this.writePickingColor(editIndex, absIndex);
    this.idToIndex.set(id, editIndex);
    this.indexToId.set(editIndex, id);
    this.count++;
    this.dirty = true;
    return absIndex;
  }

  read(id: number, bufferName: string): Float32Array | null {
    let absIndex = -1;
    if (id < this.frameOffset) {
      absIndex = id;
    } else {
      const editIndex = this.idToIndex.get(id);
      if (editIndex !== undefined) {
        absIndex = this.frameOffset + editIndex;
      }
    }

    if (absIndex === -1) return null;

    const desc = this.buffers.get(bufferName);
    if (!desc) return null;

    if (absIndex * desc.stride >= desc.data.length) return null;

    const start = absIndex * desc.stride;
    return desc.data.subarray(start, start + desc.stride);
  }

  remove(id: number): void {
    const editIndex = this.idToIndex.get(id);
    if (editIndex === undefined) return;

    const lastEditIndex = this.count - 1;
    if (editIndex !== lastEditIndex) {
      const lastId = this.indexToId.get(lastEditIndex);
      if (lastId === undefined) throw new Error("Last edit index not found");

      const srcAbs = this.frameOffset + lastEditIndex;
      const dstAbs = this.frameOffset + editIndex;

      for (const [, desc] of this.buffers) {
        const src = srcAbs * desc.stride;
        const dst = dstAbs * desc.stride;
        for (let i = 0; i < desc.stride; i++) {
          desc.data[dst + i] = desc.data[src + i];
        }
      }

      this.writePickingColor(editIndex, dstAbs);

      this.idToIndex.set(lastId, editIndex);
      this.indexToId.set(editIndex, lastId);
    }

    this.idToIndex.delete(id);
    this.indexToId.delete(lastEditIndex);
    this.count--;
    this.dirty = true;
  }

  updateMulti(id: number, values: Map<string, Float32Array | number[]>): void {
    let absIndex = -1;
    if (id < this.frameOffset) {
      absIndex = id;
    } else {
      const editIndex = this.idToIndex.get(id);
      if (editIndex !== undefined) {
        absIndex = this.frameOffset + editIndex;
      }
    }

    if (absIndex === -1) return;

    for (const [name, vals] of values) {
      const desc = this.buffers.get(name);
      if (!desc) continue;
      const arr = vals instanceof Float32Array ? vals : new Float32Array(vals);
      desc.data.set(arr, absIndex * desc.stride);
    }
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;

    const totalCount = this.frameOffset + this.count;

    // If no instances, hide and disable mesh
    if (totalCount === 0) {
      this.mesh.isVisible = false;
      this.mesh.setEnabled(false);
      this.mesh.thinInstanceCount = 0;
      this.dirty = false;
      return;
    }

    // Ensure mesh is visible when it has instances
    if (!this.mesh.isEnabled()) {
      this.mesh.setEnabled(true);
      this.mesh.isVisible = true;
    }

    const matrixDesc = this.buffers.get("matrix");
    if (matrixDesc) {
      const view = matrixDesc.data.subarray(0, totalCount * matrixDesc.stride);
      this.mesh.thinInstanceSetBuffer("matrix", view, matrixDesc.stride, false);
    }

    for (const [name, desc] of this.buffers) {
      if (name === "matrix") continue;
      const view = desc.data.subarray(0, totalCount * desc.stride);
      this.mesh.thinInstanceSetBuffer(name, view, desc.stride, false);
    }

    this.mesh.thinInstanceEnablePicking = true;
    this.dirty = false;
  }

  private grow(): void {
    const newCapacity = this.capacity * 2;
    for (const [, desc] of this.buffers) {
      const newData = new Float32Array(newCapacity * desc.stride);
      newData.set(desc.data);
      desc.data = newData;
    }
    this.capacity = newCapacity;
  }

  private writePickingColor(_editIndex: number, absIndex: number): void {
    const pickBuf = this.buffers.get("instancePickingColor");
    if (!pickBuf) return;
    const pCol = encodePickingColor(this.mesh.uniqueId, absIndex);
    pickBuf.data.set(pCol, absIndex * 4);
  }

  /**
   * Promote the frame segment [0..frameOffset) into edit space.
   * After promotion, frameOffset becomes 0 and all existing instances are editable.
   */
  promoteFrameSegmentToEdits(): void {
    if (this.frameOffset === 0) return;

    const oldFrameOffset = this.frameOffset;
    const oldEditCount = this.count;

    const newIdToIndex = new Map<number, number>();
    const newIndexToId = new Map<number, number>();

    for (let i = 0; i < oldFrameOffset; i++) {
      newIdToIndex.set(i, i);
      newIndexToId.set(i, i);
    }

    for (const [id, editIndex] of this.idToIndex) {
      const promotedIndex = oldFrameOffset + editIndex;
      newIdToIndex.set(id, promotedIndex);
      newIndexToId.set(promotedIndex, id);
    }

    this.frameOffset = 0;
    this.count = oldFrameOffset + oldEditCount;
    this.idToIndex = newIdToIndex;
    this.indexToId = newIndexToId;
  }
}

// ============ Mesh Registry ============

export const ATOM_BUFFER_DEFS = [
  { name: "matrix", stride: 16 },
  { name: "instanceData", stride: 4 },
  { name: "instanceColor", stride: 4 },
  { name: "instancePickingColor", stride: 4 },
];

export const BOND_BUFFER_DEFS = [
  { name: "matrix", stride: 16 },
  { name: "instanceData0", stride: 4 },
  { name: "instanceData1", stride: 4 },
  { name: "instanceColor0", stride: 4 },
  { name: "instanceColor1", stride: 4 },
  { name: "instanceSplit", stride: 4 },
  { name: "instancePickingColor", stride: 4 },
];

export class MeshRegistry {
  private atoms: ImpostorState | null = null;
  private bonds: ImpostorState | null = null;

  registerAtomLayer(mesh: Mesh): void {
    this.atoms = new ImpostorState(mesh, ATOM_BUFFER_DEFS);
  }

  registerBondLayer(mesh: Mesh): void {
    this.bonds = new ImpostorState(mesh, BOND_BUFFER_DEFS);
  }

  registerBox(_mesh: Mesh): void {
    // storage only
  }

  getAtomState(): ImpostorState | null {
    return this.atoms;
  }
  getBondState(): ImpostorState | null {
    return this.bonds;
  }

  getPoolForMesh(meshId: number): ImpostorState | null {
    if (this.atoms && this.atoms.mesh.uniqueId === meshId) return this.atoms;
    if (this.bonds && this.bonds.mesh.uniqueId === meshId) return this.bonds;
    return null;
  }

  allocateAtom(id: number, data: Map<string, Float32Array | number[]>): number {
    if (!this.atoms) throw new Error("No atom layer registered");
    return this.atoms.append(id, data);
  }

  allocateBond(id: number, data: Map<string, Float32Array | number[]>): number {
    if (!this.bonds) throw new Error("No bond layer registered");
    return this.bonds.append(id, data);
  }

  updateAtom(id: number, data: Map<string, Float32Array | number[]>): void {
    if (this.atoms) this.atoms.updateMulti(id, data);
  }

  updateBond(id: number, data: Map<string, Float32Array | number[]>): void {
    if (this.bonds) this.bonds.updateMulti(id, data);
  }

  freeAtom(id: number): void {
    if (this.atoms) this.atoms.remove(id);
  }

  freeBond(id: number): void {
    if (this.bonds) this.bonds.remove(id);
  }

  flushAtom(): void {
    if (this.atoms) this.atoms.flush();
  }

  flushBond(): void {
    if (this.bonds) this.bonds.flush();
  }

  clear(): void {
    this.atoms = null;
    this.bonds = null;
  }
}

// ============ SceneIndex ============

/**
 * SceneIndex: unified registry for entity metadata, GPU buffers, and topology.
 */
export class SceneIndex {
  public readonly meshRegistry = new MeshRegistry();
  public readonly metaRegistry = new MetaRegistry();
  public topology: Topology = new Topology();

  private allUnsaved = false;

  // ============ Query APIs ============

  getType(meshId: number): EntityType | null {
    const atomMesh = this.meshRegistry.getAtomState()?.mesh;
    if (atomMesh && atomMesh.uniqueId === meshId) return "atom";

    const bondMesh = this.meshRegistry.getBondState()?.mesh;
    if (bondMesh && bondMesh.uniqueId === meshId) return "bond";

    return null;
  }

  getMeta(meshId: number, subIndex?: number): EntityMeta | null {
    const atomState = this.meshRegistry.getAtomState();
    if (atomState && atomState.mesh.uniqueId === meshId) {
      if (subIndex === undefined) return null;
      const id = subIndex >= atomState.frameOffset
        ? atomState.getIdByIndex(subIndex)
        : subIndex;
      return id === undefined ? null : this.metaRegistry.atoms.getMeta(id);
    }

    const bondState = this.meshRegistry.getBondState();
    if (bondState && bondState.mesh.uniqueId === meshId) {
      if (subIndex === undefined) return null;
      const id = subIndex >= bondState.frameOffset
        ? bondState.getIdByIndex(subIndex)
        : subIndex;
      return id === undefined ? null : this.metaRegistry.bonds.getMeta(id);
    }

    return null;
  }

  /**
   * Get the selection key (MeshID:SubIndex) for a logical Atom ID.
   * This performs a reverse lookup.
   */
  getSelectionKeyForAtom(atomId: number): string | null {
    const atomState = this.meshRegistry.getAtomState();
    if (!atomState) return null;

    const editIndex = atomState.idToIndex.get(atomId);
    if (editIndex !== undefined) {
      return makeSelectionKey(atomState.mesh.uniqueId, atomState.frameOffset + editIndex);
    }
    if (atomId < atomState.frameOffset) {
      return makeSelectionKey(atomState.mesh.uniqueId, atomId);
    }
    return null;
  }

  getNextAtomId(): number {
    return this.metaRegistry.atoms.getMaxId() + 1;
  }

  getNextBondId(): number {
    return this.metaRegistry.bonds.getMaxId() + 1;
  }

  // ============ Registration APIs ============

  registerFrame(options: RegisterFrameOptions): void {
    const {
      atomMesh,
      bondMesh,
      atomBlock,
      bondBlock,
      atomBuffers,
      bondBuffers,
    } = options;

    if (!atomBlock) throw new Error("SceneIndex: atomBlock required");

    // 1. Setup MeshRegistry
    this.meshRegistry.registerAtomLayer(atomMesh);
    if (atomBuffers) {
      this.meshRegistry
        .getAtomState()
        ?.setFrameDataAndFlush(atomBuffers, atomBlock.nrows());
    }

    // 2. Setup MetaRegistry
    this.metaRegistry.atoms.setFrame(atomBlock);

    // 3. Rebuild topology from frame
    this.topology.clear();
    const atomCount = atomBlock.nrows();
    for (let i = 0; i < atomCount; i++) {
      this.topology.addAtom(i);
    }

    if (bondMesh && bondBlock) {
      this.meshRegistry.registerBondLayer(bondMesh);
      if (bondBuffers) {
        this.meshRegistry
          .getBondState()
          ?.setFrameDataAndFlush(bondBuffers, bondBlock.nrows());
      }

      this.metaRegistry.bonds.setFrame(bondBlock, atomBlock);

      const bondCount = bondBlock.nrows();
      const iAtoms = bondBlock.getColumnU32("i");
      const jAtoms = bondBlock.getColumnU32("j");
      if (iAtoms && jAtoms) {
        for (let b = 0; b < bondCount; b++) {
          this.topology.addBond(b, iAtoms[b], jAtoms[b]);
        }
      }
    }

    this.allUnsaved = false;
  }

  registerBox(options: RegisterBoxOptions): void {
    this.meshRegistry.registerBox(options.mesh);
    this.metaRegistry.box = { type: "box", ...options.meta };
  }

  registerBoxFromFrame(mesh: Mesh, meta: Omit<BoxMeta, "type">): void {
    this.meshRegistry.registerBox(mesh);
    this.metaRegistry.box = { type: "box", ...meta };
  }

  // ============ Creation / Editing APIs ============

  createAtom(
    meta: Omit<AtomMeta, "type">,
    buffers: Map<string, Float32Array | number[]>,
  ): void {
    this.meshRegistry.allocateAtom(meta.atomId, buffers);
    this.metaRegistry.atoms.setEdit(meta.atomId, { type: "atom", ...meta });
    this.topology.addAtom(meta.atomId);
    this.meshRegistry.flushAtom();
    this.markAllUnsaved();
  }

  createBond(
    meta: Omit<BondMeta, "type">,
    buffers: Map<string, Float32Array | number[]>,
  ): void {
    this.meshRegistry.allocateBond(meta.bondId, buffers);
    this.metaRegistry.bonds.setEdit(meta.bondId, { type: "bond", ...meta });
    this.topology.addBond(meta.bondId, meta.atomId1, meta.atomId2);
    this.meshRegistry.flushBond();
    this.markAllUnsaved();
  }

  unregisterEditAtom(_baseMeshId: number, atomId: number): void {
    // Ignore baseMeshId (we have global source)
    this.metaRegistry.atoms.removeEdit(atomId);
    this.topology.removeAtom(atomId);
    this.meshRegistry.freeAtom(atomId);
    this.meshRegistry.flushAtom();
    this.markAllUnsaved();
  }

  unregisterEditBond(_baseMeshId: number, bondId: number): void {
    this.metaRegistry.bonds.removeEdit(bondId);
    this.topology.removeBond(bondId);
    this.meshRegistry.freeBond(bondId);
    this.meshRegistry.flushBond();
    this.markAllUnsaved();
  }

  updateAtom(
    _baseMeshId: number,
    atomId: number,
    meta: Partial<Omit<AtomMeta, "type">>,
    bufferUpdates?: Map<string, Float32Array>,
  ): void {
    const existing = this.metaRegistry.atoms.getMeta(atomId);
    if (existing) {
      const updated = { ...existing, ...meta };
      this.metaRegistry.atoms.setEdit(atomId, updated);
    }

    if (bufferUpdates) {
      this.meshRegistry.updateAtom(atomId, bufferUpdates);
      this.meshRegistry.flushAtom();
    }
    this.markAllUnsaved();
  }

  updateBond(
    _baseMeshId: number,
    bondId: number,
    meta: Partial<Omit<BondMeta, "type">>,
    bufferUpdates?: Map<string, Float32Array>,
  ): void {
    const existing = this.metaRegistry.bonds.getMeta(bondId);
    if (existing) {
      const updated = { ...existing, ...meta };
      this.metaRegistry.bonds.setEdit(bondId, updated);
    }

    if (bufferUpdates) {
      this.meshRegistry.updateBond(bondId, bufferUpdates);
      this.meshRegistry.flushBond();
    }
    this.markAllUnsaved();
  }

  unregister(_meshId: number): void {
    this.clear();
  }

  markAllUnsaved() {
    this.allUnsaved = true;
  }

  get hasUnsavedChanges() {
    return this.allUnsaved;
  }

  markAllSaved() {
    this.allUnsaved = false;
  }

  /**
   * Convert currently loaded frame entities into editable pool entries.
   * This is used when entering Edit mode so frame atoms/bonds are editable in place.
   */
  promoteFrameToEditPool(): void {
    const atomState = this.meshRegistry.getAtomState();
    if (atomState && atomState.frameOffset > 0) {
      const atomFrameCount = atomState.frameOffset;
      for (let atomId = 0; atomId < atomFrameCount; atomId++) {
        const meta = this.metaRegistry.atoms.getMeta(atomId);
        if (meta) {
          this.metaRegistry.atoms.setEdit(atomId, { ...meta });
        }
      }
      atomState.promoteFrameSegmentToEdits();
      this.metaRegistry.atoms.frameBlock = null;
    }

    const bondState = this.meshRegistry.getBondState();
    if (bondState && bondState.frameOffset > 0) {
      const bondFrameCount = bondState.frameOffset;
      for (let bondId = 0; bondId < bondFrameCount; bondId++) {
        const meta = this.metaRegistry.bonds.getMeta(bondId);
        if (meta) {
          this.metaRegistry.bonds.setEdit(bondId, { ...meta });
        }
      }
      bondState.promoteFrameSegmentToEdits();
      this.metaRegistry.bonds.frameBlock = null;
      this.metaRegistry.bonds.atomBlock = null;
    }
  }

  clear(): void {
    this.meshRegistry.clear();
    this.metaRegistry.clear();
    this.topology.clear();
    this.allUnsaved = false;
  }

  /**
   * Compute the bounding box of the entire scene (atoms).
   */
  getBounds(): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null {
    const atomState = this.meshRegistry.getAtomState();
    if (!atomState) return null;

    const buffer = atomState.buffers.get("instanceData");
    if (!buffer) return null;

    const data = buffer.data;
    const totalCount = atomState.frameOffset + atomState.count;
    if (totalCount === 0) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    // instanceData stride is 4: [x, y, z, r]
    const stride = 4;

    for (let i = 0; i < totalCount; i++) {
      const idx = i * stride;
      const x = data[idx];
      const y = data[idx + 1];
      const z = data[idx + 2];

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;

      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    if (minX === Number.POSITIVE_INFINITY) return null;

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }

  // ============ Attribute APIs ============

  /**
   * Set an attribute for an atom.
   * Updates the staging layer (MetaRegistry).
   */
  setAttribute(type: "atom" | "bond", id: number, key: string, value: unknown) {
    if (type === "atom") {
      this.metaRegistry.atoms.setAttribute(id, key, value);
    } else if (type === "bond") {
      this.metaRegistry.bonds.setAttribute(id, key, value);
    }
    this.markAllUnsaved();
  }

  /**
   * Get an attribute value.
   */
  getAttribute(type: "atom" | "bond", id: number, key: string): unknown {
    if (type === "atom") {
      return this.metaRegistry.atoms.getAttribute(id, key);
    }
    if (type === "bond") {
      return this.metaRegistry.bonds.getAttribute(id, key);
    }
    return undefined;
  }

}
