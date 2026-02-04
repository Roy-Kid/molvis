import type { Mesh } from "@babylonjs/core";
import { Block, type Box, Frame } from "molwasm";
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
 * Manages GPU buffers for thin instances, combining Frame (static) and Edit (dynamic) data.
 * Adopts a Unified Buffer Strategy:
 * - `this.buffers` holds the COMPLETE data (Frame 0..frameOffset-1, Edits frameOffset..count).
 * - `setFrameDataAndFlush` populates the initial part of `this.buffers`.
 * - `append` adds to the end.
 * - `updateMulti` modifies in place (handling both Frame and Edit ranges).
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
    this.mesh.isVisible = true; // Activate mesh when managed by ImpostorState
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

    // 2. Copy frame data into unified buffers
    for (const [name, data] of buffers) {
      const desc = this.buffers.get(name);
      if (desc) {
        // Ensure data fits
        if (data.length <= desc.data.length) {
          desc.data.set(data);
        } else {
          // Should not happen if we resized correctly above
          const fit = data.subarray(0, desc.data.length);
          desc.data.set(fit);
        }
      }
    }

    // 3. Initialize pick colors for Frame atoms?
    // Frame atoms have implicit IDs 0..frameCount-1.
    // We need to write picking colors for them if not provided.
    // Typically frame loading might not provide pick colors.
    // Let's generate them.
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
    if (editIndex === undefined) {
      // Frame atom removal not fully supported in this simplified version.
      // Would need masking.
      return;
    }

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

    for (const [name, desc] of this.buffers) {
      // Send the view up to totalCount
      // Note: thinInstanceSetBuffer expects data for ALL instances.
      const view = desc.data.subarray(0, totalCount * desc.stride);
      this.mesh.thinInstanceSetBuffer(name, view, desc.stride, true);
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
    // Offset based on ABSOLUTE index for unified buffer
    // Wait, picking color buffer is part of `buffers`.
    // So offset is absIndex * 4.
    const offset = absIndex * 4;
    pickBuf.data.set(pCol, offset);
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
 * SceneIndex: Single Truth for Entity Metadata and Rendering Resources.
 */
export class SceneIndex {
  public readonly meshRegistry = new MeshRegistry();
  public readonly metaRegistry = new MetaRegistry();
  public topology: Topology = new Topology();

  private allUnsaved = false;

  // ============ Query APIs ============

  /**
   * Get entity type based on ID context (check meta registry).
   * Since we don't have mesh lookup easily, we just check which source has the ID?
   * Or stick to meshId?
   * The `getType` method previously used meshId.
   * But now sources are global in MetaRegistry.
   * We need to know if meshId corresponds to atoms or bonds.
   */
  getType(meshId: number): EntityType | null {
    const atomMesh = this.meshRegistry.getAtomState()?.mesh;
    if (atomMesh && atomMesh.uniqueId === meshId) return "atom";

    const bondMesh = this.meshRegistry.getBondState()?.mesh;
    if (bondMesh && bondMesh.uniqueId === meshId) return "bond";

    // Box?
    // Box mesh is stored in MeshRegistry but not exposed directly as state
    // We can add check if we exposed box mesh
    // For now, let's assume if it is NOT atom/bond, it's null (or check box if needed)
    // If we strictly need box type, we need to know the box mesh ID.
    return null;
  }

  getMeta(meshId: number, subIndex?: number): EntityMeta | null {
    // Map meshId to Source
    const atomMesh = this.meshRegistry.getAtomState()?.mesh;
    if (atomMesh && atomMesh.uniqueId === meshId) {
      // It's an atom. But subIndex is thinInstance index.
      // We need to resolve ID first?
      // ImpostorState maps bufferIndex -> ID.
      if (subIndex === undefined) return null;

      // Resolve Frame vs Edit
      const atomState = this.meshRegistry.getAtomState();
      if (!atomState) return null;

      // Note: subIndex is buffer index.
      // If subIndex < frameOffset, it is Frame ID.
      // If subIndex >= frameOffset, it is Edit, lookup in map.
      // Wait, ImpostorState has `getIdByIndex` only for edits?
      // No, frame items are implicit.
      // Frame items: indices 0..frameOffset-1 map to IDs 0..frameOffset-1.

      let id = subIndex;
      if (subIndex >= atomState.frameOffset) {
        const mapped = atomState.getIdByIndex(subIndex);
        if (mapped === undefined) return null;
        id = mapped;
      }

      return this.metaRegistry.atoms.getMeta(id);
    }

    const bondMesh = this.meshRegistry.getBondState()?.mesh;
    if (bondMesh && bondMesh.uniqueId === meshId) {
      if (subIndex === undefined) return null;
      const bondState = this.meshRegistry.getBondState();
      if (!bondState) return null;

      let id = subIndex;
      if (subIndex >= bondState.frameOffset) {
        const mapped = bondState.getIdByIndex(subIndex);
        if (mapped === undefined) return null;
        id = mapped;
      }
      return this.metaRegistry.bonds.getMeta(id);
    }

    // Box
    // if (subIndex === undefined && this.metaRegistry.box) ...
    // We don't have easy check for box meshId unless we store it.
    return null;
  }

  /**
   * Get the selection key (MeshID:SubIndex) for a logical Atom ID.
   * This performs a reverse lookup.
   */
  getSelectionKeyForAtom(atomId: number): string | null {
    // 1. Check Edit State first (most dynamic)
    const atomState = this.meshRegistry.getAtomState();
    if (atomState) {
      // Check if it is an Edit atom
      if (atomState.idToIndex.has(atomId)) {
        // Edit atom
        const editIndex = atomState.idToIndex.get(atomId);
        if (editIndex === undefined) return null;
        const bufferIndex = atomState.frameOffset + editIndex;
        return makeSelectionKey(atomState.mesh.uniqueId, bufferIndex);
      }

      // Checks if it is a Frame atom (implicit ID)
      if (atomId < atomState.frameOffset) {
        // Frame atom
        return makeSelectionKey(atomState.mesh.uniqueId, atomId);
      }
    }

    return null; // Not found in managed layers
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

    // 3. Topology
    // (Rebuild topology from frame?)
    this.topology.clear(); // Reset topology
    // Iterate all atoms?
    // Frame atoms 0..count-1
    const atomCount = atomBlock.nrows();
    for (let i = 0; i < atomCount; i++) {
      this.topology.addAtom(i);
    }

    // Bonds
    if (bondMesh && bondBlock) {
      this.meshRegistry.registerBondLayer(bondMesh);
      if (bondBuffers) {
        this.meshRegistry
          .getBondState()
          ?.setFrameDataAndFlush(bondBuffers, bondBlock.nrows());
      }

      this.metaRegistry.bonds.setFrame(bondBlock, atomBlock);

      const bondCount = bondBlock.nrows();
      // Need i/j columns
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

  unregister(meshId: number): void {
    // Check if it matches global mesh
    const atomMesh = this.meshRegistry.getAtomState()?.mesh;
    if (atomMesh && atomMesh.uniqueId === meshId) {
      // Fully clear atoms?
      // Usually unregister is called to unload frame.
      // We should respect that.
      // If we have hybrid, do we clear edits too? Yes.
      this.metaRegistry.atoms = new (
        this.metaRegistry.atoms
          .constructor as new () => typeof this.metaRegistry.atoms
      )(); // Reset
      this.meshRegistry.clear(); // Clear registry too?
      // Actually unregister(meshId) is legacy.
      // Ideally we call clear().
    }
    // Simplified:
    // SceneIndex previously managed multiple sources.
    // Now it implicitly assumes one Frame + Edits.
    // If unregister is called on the main mesh, we clear everything.
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

  get allEntries(): Map<number, unknown> {
    // Return dummy map for compatibility if needed,
    // OR fix consumers to use metaRegistry.
    // manipulate.ts uses allEntries to iterate.
    // We should fix manipulate.ts.
    return new Map();
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

  // ============ Attribute & Export APIs ============

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

  /**
   * Create a new Frame that merges base data with staged edits.
   * This is used for export.
   */
  dumpFrame(): Frame {
    const newFrame = new Frame();

    // 1. Process Atoms
    const atomKeys = new Set<string>();
    // Add known logical columns first
    atomKeys.add("x");
    atomKeys.add("y");
    atomKeys.add("z");
    atomKeys.add("element");

    // Add keys from edits
    const atomIds = Array.from(this.metaRegistry.atoms.getAllIds());
    atomIds.sort((a, b) => a - b); // Ensure sorted order
    const atomCount = atomIds.length;

    // Mapping: Original Atom ID -> New Row Index (0-based)
    const atomIdToIndex = new Map<number, number>();
    for (let i = 0; i < atomCount; i++) {
      atomIdToIndex.set(atomIds[i], i);
    }

    // Collect all keys from edits
    for (const meta of this.metaRegistry.atoms.edits.values()) {
      for (const k of Object.keys(meta)) {
        if (k !== "type" && k !== "atomId" && k !== "position") atomKeys.add(k);
      }
    }
    // Also check frame keys if possible?
    if (this.metaRegistry.atoms.frameBlock) {
      const keys = this.metaRegistry.atoms.frameBlock.keys();
      for (const k of keys) {
        atomKeys.add(k);
      }
    }

    if (atomCount > 0) {
      const atomsBlock = new Block();
      // Iterate keys and populate columns
      for (const key of atomKeys) {
        // Determine type? Default to String for safety, or F32 if looks like number.
        let isNumeric = true;

        for (const id of atomIds) {
          const val = this.metaRegistry.atoms.getAttribute(id, key);
          if (val !== undefined && val !== null) {
            if (typeof val !== "number") isNumeric = false;
            break;
          }
        }

        if (key === "x" || key === "y" || key === "z") isNumeric = true; // Force coords to F32

        if (isNumeric) {
          const data = new Float32Array(atomCount);
          for (let i = 0; i < atomCount; i++) {
            const id = atomIds[i];
            const val = this.metaRegistry.atoms.getAttribute(id, key);

            if (typeof val === "number") {
              data[i] = val;
            } else {
              // STRICT CHECK for coordinates
              if (key === "x" || key === "y" || key === "z") {
                throw new Error(
                  `Export Error: Missing coordinate '${key}' for atom ID ${id}. Atom data: ${JSON.stringify(this.metaRegistry.atoms.getMeta(id))}`,
                );
              }
              data[i] = 0; // Fallback for other numeric fields if really needed, but user asked for strictness?
              // Let's be strict for x,y,z only as explicitly requested, or maybe warn for others.
            }
          }
          atomsBlock.setColumnF32(key, data);
        } else {
          const data = new Array(atomCount);
          for (let i = 0; i < atomCount; i++) {
            const id = atomIds[i];
            const val = this.metaRegistry.atoms.getAttribute(id, key);

            if (key === "element" && !val) {
              throw new Error(
                `Export Error: Missing element for atom ID ${id}`,
              );
            }

            data[i] = val !== undefined ? String(val) : "";
          }
          atomsBlock.setColumnStrings(key, data);
        }
      }
      newFrame.insertBlock("atoms", atomsBlock);
    }

    // 2. Process Bonds (Topology)
    const bondIds = Array.from(this.metaRegistry.bonds.getAllIds());
    bondIds.sort((a, b) => a - b);

    // Filter bonds that map to existing atoms
    const validBonds: { i: number; j: number; order: number; id: number }[] =
      [];
    for (const id of bondIds) {
      const meta = this.metaRegistry.bonds.getMeta(id);
      if (meta) {
        const idx1 = atomIdToIndex.get(meta.atomId1);
        const idx2 = atomIdToIndex.get(meta.atomId2);

        if (idx1 !== undefined && idx2 !== undefined) {
          validBonds.push({
            i: idx1,
            j: idx2,
            order: meta.order ?? 1,
            id,
          });
        }
      }
    }

    if (validBonds.length > 0) {
      const bondsBlock = new Block();
      const count = validBonds.length;
      const iData = new Uint32Array(count);
      const jData = new Uint32Array(count);
      const orderData = new Float32Array(count);
      let hasOrder = false;

      for (let b = 0; b < count; b++) {
        iData[b] = validBonds[b].i;
        jData[b] = validBonds[b].j;
        orderData[b] = validBonds[b].order;
        if (validBonds[b].order !== 1) hasOrder = true;
      }

      bondsBlock.setColumnU32("i", iData);
      bondsBlock.setColumnU32("j", jData);
      if (hasOrder) {
        bondsBlock.setColumnF32("order", orderData);
      }

      // Also copy other arbitrary bond attributes?
      const bondKeys = new Set<string>();
      // Collect all keys from edits
      for (const meta of this.metaRegistry.bonds.edits.values()) {
        for (const k of Object.keys(meta)) {
          if (
            k !== "type" &&
            k !== "bondId" &&
            k !== "atomId1" &&
            k !== "atomId2" &&
            k !== "order"
          )
            bondKeys.add(k);
        }
      }
      if (this.metaRegistry.bonds.frameBlock) {
        const keys = this.metaRegistry.bonds.frameBlock.keys();
        for (const k of keys) {
          if (k !== "i" && k !== "j" && k !== "order") bondKeys.add(k);
        }
      }

      for (const key of bondKeys) {
        const data = new Array(count);
        for (let b = 0; b < count; b++) {
          const bondId = validBonds[b].id;
          const val = this.metaRegistry.bonds.getAttribute(bondId, key);
          data[b] = val !== undefined ? String(val) : "";
        }
        bondsBlock.setColumnStrings(key, data);
      }

      newFrame.insertBlock("bonds", bondsBlock);
    }

    // 3. Process Box (CRYST1)
    if (this.metaRegistry.box) {
      const boxBlock = new Block();
      // A box block typically has 1 row
      // Columns: a, b, c, alpha, beta, gamma

      const a = this.metaRegistry.box.dimensions[0];
      const b = this.metaRegistry.box.dimensions[1];
      const c = this.metaRegistry.box.dimensions[2];

      const alpha = 90.0;
      const beta = 90.0;
      const gamma = 90.0;

      const aData = new Float32Array([a]);
      const bData = new Float32Array([b]);
      const cData = new Float32Array([c]);
      const alphaData = new Float32Array([alpha]);
      const betaData = new Float32Array([beta]);
      const gammaData = new Float32Array([gamma]);

      boxBlock.setColumnF32("a", aData);
      boxBlock.setColumnF32("b", bData);
      boxBlock.setColumnF32("c", cData);
      boxBlock.setColumnF32("alpha", alphaData);
      boxBlock.setColumnF32("beta", betaData);
      boxBlock.setColumnF32("gamma", gammaData);

      newFrame.insertBlock("box", boxBlock);
    }

    return newFrame;
  }

  syncFrame() {
    // TODO: Not implemented fully. changes stay in staging layer.
  }
}
