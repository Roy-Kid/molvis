import { Block, type Frame } from "@molcrafts/molrs";
import { logger } from "../utils/logger";
import type { SceneIndex } from "./scene_index";

export interface SyncSceneToFrameOptions {
  markSaved?: boolean;
}

/**
 * Synchronize scene data (meshes and thin instances) back to Frame.
 * Effectively dumps the current state of SceneIndex (MetaRegistry) into a new Frame structure.
 */
export function syncSceneToFrame(
  sceneIndex: SceneIndex,
  frame: Frame,
  options: SyncSceneToFrameOptions = {},
): void {
  // Clear the frame
  frame.clear();

  const atoms: Array<{ x: number; y: number; z: number; element: string }> = [];
  const bonds: Array<{ atomId1: number; atomId2: number; order: number }> = [];

  // Mapping from global semantic Atom ID -> New Frame Index
  // Ideally we preserve IDs if possible, but Frame implies contiguous 0..N packing.
  // If our IDs are sparse (e.g. we deleted some), we must re-index.
  // SceneIndex IDs might be sparse if we support deletion (which we do via removal from edits,
  // but Frame deletions are tricky).
  // For now, let's just pack them.
  const atomIdToFrameIndex = new Map<number, number>();

  // 1. Collect Atoms
  for (const atomId of sceneIndex.metaRegistry.atoms.getAllIds()) {
    const meta = sceneIndex.metaRegistry.atoms.getMeta(atomId);
    if (!meta) continue;

    atomIdToFrameIndex.set(atomId, atoms.length);
    atoms.push({
      x: meta.position.x,
      y: meta.position.y,
      z: meta.position.z,
      element: meta.element,
    });
  }

  // 2. Collect Bonds
  for (const bondId of sceneIndex.metaRegistry.bonds.getAllIds()) {
    const meta = sceneIndex.metaRegistry.bonds.getMeta(bondId);
    if (!meta) continue;

    const idx1 = atomIdToFrameIndex.get(meta.atomId1);
    const idx2 = atomIdToFrameIndex.get(meta.atomId2);

    if (idx1 !== undefined && idx2 !== undefined) {
      bonds.push({
        atomId1: idx1,
        atomId2: idx2,
        order: meta.order,
      });
    } else {
      // Bond refers to deleted atoms?
    }
  }

  // 3. Populate Frame
  const atomCount = atoms.length;
  if (atomCount > 0) {
    const atomBlock = new Block();
    const x = new Float32Array(atomCount);
    const y = new Float32Array(atomCount);
    const z = new Float32Array(atomCount);
    const elements: string[] = [];

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      x[i] = atom.x;
      y[i] = atom.y;
      z[i] = atom.z;
      elements.push(atom.element);
    }

    atomBlock.setColumnF32("x", x);
    atomBlock.setColumnF32("y", y);
    atomBlock.setColumnF32("z", z);
    atomBlock.setColumnStrings("element", elements);

    frame.insertBlock("atoms", atomBlock);
  }

  const bondCount = bonds.length;
  if (bondCount > 0) {
    const bondBlock = new Block();
    const iArr = new Uint32Array(bondCount);
    const jArr = new Uint32Array(bondCount);
    const orderArr = new Uint8Array(bondCount);

    for (let idx = 0; idx < bonds.length; idx++) {
      const bond = bonds[idx];
      iArr[idx] = bond.atomId1;
      jArr[idx] = bond.atomId2;
      orderArr[idx] = bond.order;
    }

    bondBlock.setColumnU32("i", iArr);
    bondBlock.setColumnU32("j", jArr);
    bondBlock.setColumnU8("order", orderArr);

    frame.insertBlock("bonds", bondBlock);
  }

  // Box synchronization intentionally omitted until a typed Frame box API is exposed.

  logger.info(
    `[syncSceneToFrame] Synchronized ${atomCount} atoms and ${bondCount} bonds.`,
  );
  if (options.markSaved !== false) {
    sceneIndex.markAllSaved();
  }
}
