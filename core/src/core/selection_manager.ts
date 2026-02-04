import type { SceneIndex } from "./scene_index";

export type SelectionKey = string;

export interface SelectionRef {
  meshId: number;
  subIndex?: number;
}

export function makeSelectionKey(
  meshId: number,
  subIndex?: number,
): SelectionKey {
  return subIndex === undefined ? String(meshId) : `${meshId}:${subIndex}`;
}

export function parseSelectionKey(key: SelectionKey): SelectionRef | null {
  const [meshPart, subPart] = key.split(":");
  if (!meshPart) return null;

  const meshId = Number(meshPart);
  if (!Number.isFinite(meshId)) return null;

  if (subPart === undefined || subPart === "") {
    return { meshId };
  }

  const subIndex = Number(subPart);
  if (!Number.isFinite(subIndex)) {
    return { meshId };
  }

  return { meshId, subIndex };
}

// ============ Types (Colocated) ============

/**
 * Selection state using selection keys.
 */
export interface SelectionState {
  atoms: Set<SelectionKey>;
  bonds: Set<SelectionKey>;
}

export interface SelectedEntity {
  type: "atom" | "bond";
  meshId: number;
  instanceIndex: number;
}

/**
 * Response structure for get_selected command.
 * Format is compatible with molpy.Frame construction.
 */
export interface GetSelectedResponse {
  atoms: {
    atomId: number[];
    element: string[];
    x: number[];
    y: number[];
    z: number[];
  };
  bonds: {
    bondId: number[];
    atomId1: number[];
    atomId2: number[];
    order: number[];
    start_x: number[];
    start_y: number[];
    start_z: number[];
    end_x: number[];
    end_y: number[];
    end_z: number[];
  };
}

/**
 * Selection operations.
 */
export type SelectionOp =
  | { type: "replace"; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
  | { type: "add"; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
  | { type: "remove"; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
  | { type: "toggle"; atoms?: SelectionKey[]; bonds?: SelectionKey[] }
  | { type: "clear" };

// ============ SelectionManager ============

/**
 * SelectionManager: Maintains selection state using selection keys.
 * Emits events for highlighting.
 *
 * Responsibilities:
 * - Maintain selection state (atoms and bonds)
 * - Apply selection operations
 * - Emit change events for highlighting
 */
export class SelectionManager {
  private state: SelectionState = { atoms: new Set(), bonds: new Set() };
  private listeners: Array<(state: SelectionState) => void> = [];
  private sceneIndex: SceneIndex;

  constructor(sceneIndex: SceneIndex) {
    this.sceneIndex = sceneIndex;
  }

  /**
   * Apply a selection operation.
   *
   * @param op - The selection operation to apply
   */
  apply(op: SelectionOp): void {
    switch (op.type) {
      case "replace":
        this.state.atoms = new Set(op.atoms || []);
        this.state.bonds = new Set(op.bonds || []);
        break;

      case "add":
        if (op.atoms) {
          for (const id of op.atoms) {
            this.state.atoms.add(id);
          }
        }
        if (op.bonds) {
          for (const id of op.bonds) {
            this.state.bonds.add(id);
          }
        }
        break;

      case "remove":
        if (op.atoms) {
          for (const id of op.atoms) {
            this.state.atoms.delete(id);
          }
        }
        if (op.bonds) {
          for (const id of op.bonds) {
            this.state.bonds.delete(id);
          }
        }
        break;

      case "toggle":
        if (op.atoms) {
          for (const id of op.atoms) {
            if (this.state.atoms.has(id)) {
              this.state.atoms.delete(id);
            } else {
              this.state.atoms.add(id);
            }
          }
        }
        if (op.bonds) {
          for (const id of op.bonds) {
            if (this.state.bonds.has(id)) {
              this.state.bonds.delete(id);
            } else {
              this.state.bonds.add(id);
            }
          }
        }
        break;

      case "clear":
        this.state.atoms.clear();
        this.state.bonds.clear();
        break;
    }

    this.emit();
  }

  /**
   * Check if a selection key is selected.
   *
   * @param key - The selection key
   * @returns true if selected, false otherwise
   */
  isSelected(key: SelectionKey): boolean {
    const ref = parseSelectionKey(key);
    if (!ref) return false;

    const meta = this.sceneIndex.getMeta(ref.meshId, ref.subIndex);
    if (!meta) return false;

    if (meta.type === "atom") {
      return this.state.atoms.has(key);
    }
    if (meta.type === "bond") {
      return this.state.bonds.has(key);
    }
    return false;
  }

  /**
   * Get the current selection state.
   *
   * @returns The current selection state
   */
  getState(): SelectionState {
    return this.state;
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    this.apply({ type: "clear" });
  }

  /**
   * Select atoms by their SceneIndex Atomic IDs.
   * This requires scanning the Scene Index/Meta Registry to find matching keys.
   *
   * @param ids - Array of atom IDs to select
   */
  selectAtomsByIds(_ids: number[]): void {
    const keysToAdd: SelectionKey[] = [];

    // Inefficient scan?
    // SceneIndex stores ID -> Meta.
    // We need Meta -> Key (MeshID + InstanceID)
    // MetaRegistry stores by ID.
    // Wait, `dumpFrame` iterates all IDs.
    // We can iterate all registered meshes in SceneIndex?
    // Or better: SceneIndex should provide `getMeshAndIndex(atomId)`.

    // Let's assume SceneIndex has `getAtomLocation(atomId)`.
    // If not, we iterate all atoms in MetaRegistry.

    // Actually, `SelectionKey` is based on MeshID:InstanceID (babylon concept).
    // `AtomID` is logical ID.
    // We need a map AtomID -> SelectionKey.

    // SceneIndex.ts:
    // `this.metaRegistry.atoms.getMeta(id)` returns { ...position, atomId, type }.
    // But it doesn't store WHICH mesh it is in?
    // The meshRegistry stores sets of IDs per mesh?

    // Let's check SceneIndex implementation for reverse lookup.
    // For now, I will use a direct lookup if exposed, or add it to SceneIndex.

    // Assuming SceneIndex has `getSelectionKeyForAtom(atomId)`.
    // I will add this method to SceneIndex in next step.
    // For now, call it.

    for (const id of ids) {
      const key = this.sceneIndex.getSelectionKeyForAtom(id);
      if (key) keysToAdd.push(key);
    }

    if (keysToAdd.length > 0) {
      this.apply({ type: "add", atoms: keysToAdd });
    }
  }

  /**
   * Get IDs of all selected atoms.
   */
  getSelectedAtomIds(): Set<number> {
    const ids = new Set<number>();
    for (const key of this.state.atoms) {
      const ref = parseSelectionKey(key);
      if (!ref) continue;
      const meta = this.sceneIndex.getMeta(ref.meshId, ref.subIndex);
      if (meta?.type === "atom") {
        ids.add(meta.atomId);
      }
    }
    return ids;
  }

  /**
   * Get metadata for all selected entities.
   * Returns data in molpy.Frame compatible format.
   *
   * @returns Object with columnar arrays of atom and bond metadata
   */
  getSelectedMeta(): GetSelectedResponse {
    const atomIds: number[] = [];
    const elements: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];

    const bondIds: number[] = [];
    const atomId1s: number[] = [];
    const atomId2s: number[] = [];
    const orders: number[] = [];
    const startXs: number[] = [];
    const startYs: number[] = [];
    const startZs: number[] = [];
    const endXs: number[] = [];
    const endYs: number[] = [];
    const endZs: number[] = [];

    // Collect atom metadata
    for (const key of this.state.atoms) {
      const ref = parseSelectionKey(key);
      if (!ref) continue;

      const meta = this.sceneIndex.getMeta(ref.meshId, ref.subIndex);
      if (meta?.type === "atom") {
        atomIds.push(meta.atomId);
        elements.push(meta.element);
        xs.push(meta.position.x);
        ys.push(meta.position.y);
        zs.push(meta.position.z);
      }
    }

    // Collect bond metadata
    for (const key of this.state.bonds) {
      const ref = parseSelectionKey(key);
      if (!ref) continue;

      const meta = this.sceneIndex.getMeta(ref.meshId, ref.subIndex);
      if (meta?.type === "bond") {
        bondIds.push(meta.bondId);
        atomId1s.push(meta.atomId1);
        atomId2s.push(meta.atomId2);
        orders.push(meta.order);
        startXs.push(meta.start.x);
        startYs.push(meta.start.y);
        startZs.push(meta.start.z);
        endXs.push(meta.end.x);
        endYs.push(meta.end.y);
        endZs.push(meta.end.z);
      }
    }

    return {
      atoms: {
        atomId: atomIds,
        element: elements,
        x: xs,
        y: ys,
        z: zs,
      },
      bonds: {
        bondId: bondIds,
        atomId1: atomId1s,
        atomId2: atomId2s,
        order: orders,
        start_x: startXs,
        start_y: startYs,
        start_z: startZs,
        end_x: endXs,
        end_y: endYs,
        end_z: endZs,
      },
    };
  }

  /**
   * Register a change event listener.
   *
   * @param handler - Function to call when selection changes
   */
  on(handler: (state: SelectionState) => void): void {
    this.listeners.push(handler);
  }

  /**
   * Remove a change event listener.
   *
   * @param handler - The handler to remove
   */
  off(handler: (state: SelectionState) => void): void {
    this.listeners = this.listeners.filter((h) => h !== handler);
  }

  /**
   * Emit change event to all listeners.
   */
  private emit(): void {
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }
}
