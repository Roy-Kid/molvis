import { type Mesh, type Scene, Vector3 } from "@babylonjs/core";
import * as keys from "@molcrafts/molvis-core/keys";
import type { Frame } from "@molcrafts/molvis-core/molrs";
import { type Block, Frame as MolrsFrame } from "@molcrafts/molvis-core/molrs";
import type { MolvisApp } from "../app";
import type { SceneIndex } from "../scene_index";
import type { SelectedEntity } from "../selection_manager";
import { logger } from "../utils/logger";
import { Command, command } from "./base";
import { commands } from "./registry";

function getThinInstanceMatrixBuffer(mesh: Mesh): Float32Array | null {
  const storage = (
    mesh as unknown as {
      _thinInstanceDataStorage?: { matrixData?: Float32Array };
    }
  )._thinInstanceDataStorage;
  const buffer = storage?.matrixData ?? null;
  return buffer instanceof Float32Array ? buffer : null;
}

function getThinInstanceColorBuffer(mesh: Mesh): Float32Array | null {
  const storage = (
    mesh as unknown as {
      _userThinInstanceBuffersStorage?: { data?: Record<string, Float32Array> };
    }
  )._userThinInstanceBuffersStorage;
  const buffer = storage?.data?.color ?? null;
  return buffer instanceof Float32Array ? buffer : null;
}

function findThinInstanceMesh(
  scene: Scene,
  sceneIndex: SceneIndex,
  type: "atom" | "bond",
): Mesh | null {
  return (
    (scene.meshes.find((mesh) => {
      const asMesh = mesh as Mesh;
      if (!asMesh.hasThinInstances) return false;
      const meta = sceneIndex.getMeta(mesh.uniqueId, 0);
      return meta?.type === type;
    }) as Mesh | null) ?? null
  );
}

/**
 * Command to move selected atoms and bonds.
 * Stores original positions for undo support.
 */
export class MoveSelectionCommand extends Command<void> {
  private selectedEntities: SelectedEntity[];
  private delta: Vector3;
  private originalPositions: Map<string, Vector3> = new Map();

  constructor(
    app: MolvisApp,
    args: {
      selectedEntities: SelectedEntity[];
      delta: Vector3;
    },
  ) {
    super(app);
    this.selectedEntities = args.selectedEntities;
    this.delta = args.delta;
  }

  do(): void {
    const scene = this.app.world.scene;

    // Store original positions and move atoms
    for (const entity of this.selectedEntities) {
      if (entity.type !== "atom") continue;

      const mesh = scene.getMeshByUniqueId(entity.meshId) as Mesh;
      const matrices = mesh ? getThinInstanceMatrixBuffer(mesh) : null;
      if (!matrices) continue;
      const offset = entity.instanceIndex * 16;

      // Store original position
      const key = `${entity.meshId}:${entity.instanceIndex}`;
      this.originalPositions.set(
        key,
        new Vector3(
          matrices[offset + 12],
          matrices[offset + 13],
          matrices[offset + 14],
        ),
      );

      // Apply delta
      matrices[offset + 12] += this.delta.x;
      matrices[offset + 13] += this.delta.y;
      matrices[offset + 14] += this.delta.z;

      const pool = this.app.world.sceneIndex.meshRegistry.getPoolForMesh(
        entity.meshId,
      );
      if (pool) pool.uploadBuffer("matrix");
      else mesh.thinInstanceBufferUpdated("matrix");
    }

    // Update connected bonds
    this.updateConnectedBonds();
  }

  undo(): Command {
    const scene = this.app.world.scene;

    // Restore original positions
    for (const entity of this.selectedEntities) {
      if (entity.type !== "atom") continue;

      const mesh = scene.getMeshByUniqueId(entity.meshId) as Mesh;
      const matrices = mesh ? getThinInstanceMatrixBuffer(mesh) : null;
      if (!matrices) continue;

      const key = `${entity.meshId}:${entity.instanceIndex}`;
      const originalPos = this.originalPositions.get(key);
      if (!originalPos) continue;

      const offset = entity.instanceIndex * 16;

      matrices[offset + 12] = originalPos.x;
      matrices[offset + 13] = originalPos.y;
      matrices[offset + 14] = originalPos.z;

      const pool = this.app.world.sceneIndex.meshRegistry.getPoolForMesh(
        entity.meshId,
      );
      if (pool) pool.uploadBuffer("matrix");
      else mesh.thinInstanceBufferUpdated("matrix");
    }

    // Update connected bonds
    this.updateConnectedBonds();

    return this;
  }

  /**
   * Update bond positions based on current atom positions.
   * Bonds are represented as cylinders between two atoms.
   */
  private updateConnectedBonds(): void {
    const scene = this.app.world.scene;

    const atomMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "atom",
    );
    if (!atomMesh) return;

    const atomMatrices = getThinInstanceMatrixBuffer(atomMesh);
    if (!atomMatrices) return;

    const bondMeshes = scene.meshes.filter((mesh) => {
      const asMesh = mesh as Mesh;
      if (!asMesh.hasThinInstances) return false;
      const meta = this.app.world.sceneIndex.getMeta(mesh.uniqueId, 0);
      return meta?.type === "bond";
    }) as Mesh[];

    for (const bondMesh of bondMeshes) {
      const matrices = getThinInstanceMatrixBuffer(bondMesh);
      if (!matrices) continue;

      const bondCount = Math.floor(matrices.length / 16);
      for (let bondIdx = 0; bondIdx < bondCount; bondIdx++) {
        const meta = this.app.world.sceneIndex.getMeta(
          bondMesh.uniqueId,
          bondIdx,
        );
        if (meta?.type !== "bond") continue;

        const offset1 = meta.atomId1 * 16;
        const offset2 = meta.atomId2 * 16;
        if (
          offset1 + 14 >= atomMatrices.length ||
          offset2 + 14 >= atomMatrices.length
        ) {
          continue;
        }

        const pos1 = new Vector3(
          atomMatrices[offset1 + 12],
          atomMatrices[offset1 + 13],
          atomMatrices[offset1 + 14],
        );

        const pos2 = new Vector3(
          atomMatrices[offset2 + 12],
          atomMatrices[offset2 + 13],
          atomMatrices[offset2 + 14],
        );

        const bondCenter = Vector3.Center(pos1, pos2);
        const bondVector = pos2.subtract(pos1);
        const bondLength = bondVector.length();

        const bondOffset = bondIdx * 16;

        const up = new Vector3(0, 1, 0);
        const axis = Vector3.Cross(up, bondVector.normalize());
        const angle = Math.acos(Vector3.Dot(up, bondVector.normalize()));

        const rotationMatrix =
          axis.length() > 0.001
            ? BABYLON.Matrix.RotationAxis(axis.normalize(), angle)
            : BABYLON.Matrix.Identity();

        const scaleMatrix = BABYLON.Matrix.Scaling(1, bondLength, 1);
        const translationMatrix = BABYLON.Matrix.Translation(
          bondCenter.x,
          bondCenter.y,
          bondCenter.z,
        );

        const finalMatrix = scaleMatrix
          .multiply(rotationMatrix)
          .multiply(translationMatrix);

        for (let i = 0; i < 16; i++) {
          matrices[bondOffset + i] = finalMatrix.m[i];
        }
      }

      const bondPool = this.app.world.sceneIndex.meshRegistry.getPoolForMesh(
        bondMesh.uniqueId,
      );
      if (bondPool) bondPool.uploadBuffer("matrix");
      else bondMesh.thinInstanceBufferUpdated("matrix");
    }
  }
}

// Import BABYLON for matrix operations
import * as BABYLON from "@babylonjs/core";

/**
 * Data structure for clipboard contents.
 */
export interface ClipboardData {
  atoms: Array<{ element: string; relativePosition: Vector3 }>;
  bonds: Array<{ i: number; j: number; order: number }>;
}

/**
 * Command to paste selected atoms and bonds.
 * Creates new atoms/bonds at specified position and supports undo.
 */
export class PasteSelectionCommand extends Command<void> {
  private clipboardData: ClipboardData;
  private pastePosition: Vector3;
  private createdAtomIndices: number[] = [];
  private createdBondIndices: number[] = [];

  constructor(
    app: MolvisApp,
    args: {
      clipboardData: ClipboardData;
      pastePosition: Vector3;
    },
  ) {
    super(app);
    this.clipboardData = args.clipboardData;
    this.pastePosition = args.pastePosition;
  }

  do(): void {
    const scene = this.app.world.scene;

    // Get atom mesh
    const atomMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "atom",
    );
    if (!atomMesh) {
      logger.error("Cannot paste: atom mesh not found");
      return;
    }

    const atomMatrices = getThinInstanceMatrixBuffer(atomMesh);
    const atomColors = getThinInstanceColorBuffer(atomMesh);
    if (!atomMatrices || !atomColors) {
      logger.error("Cannot paste: atom mesh missing buffers");
      return;
    }

    // Calculate current atom count
    const currentAtomCount = atomMatrices.length / 16;

    // Create new atoms
    const newAtomMatrices: number[] = [];
    const newAtomColors: number[] = [];

    for (const atomData of this.clipboardData.atoms) {
      const absolutePosition = this.pastePosition.add(
        atomData.relativePosition,
      );

      // Create transformation matrix
      const matrix = BABYLON.Matrix.Translation(
        absolutePosition.x,
        absolutePosition.y,
        absolutePosition.z,
      );

      // Add matrix to buffer
      for (let i = 0; i < 16; i++) {
        newAtomMatrices.push(matrix.m[i]);
      }

      // Add color (default white for now, could be element-based)
      newAtomColors.push(1.0, 1.0, 1.0, 1.0);

      // SceneIndex metadata sync for pasted atoms is intentionally deferred.
      // atomElements.push(atomData.element);

      // Track created atom index
      this.createdAtomIndices.push(
        currentAtomCount + this.createdAtomIndices.length,
      );
    }

    // Extend atom buffers
    const extendedAtomMatrices = new Float32Array(
      atomMatrices.length + newAtomMatrices.length,
    );
    extendedAtomMatrices.set(atomMatrices);
    extendedAtomMatrices.set(newAtomMatrices, atomMatrices.length);

    const extendedAtomColors = new Float32Array(
      atomColors.length + newAtomColors.length,
    );
    extendedAtomColors.set(atomColors);
    extendedAtomColors.set(newAtomColors, atomColors.length);

    // Update mesh buffers
    atomMesh.thinInstanceSetBuffer("matrix", extendedAtomMatrices, 16, true);
    atomMesh.thinInstanceSetBuffer("color", extendedAtomColors, 4, true);

    // Create bonds if any
    if (this.clipboardData.bonds.length > 0) {
      this.createBonds(currentAtomCount);
    }
  }

  undo(): Command {
    const scene = this.app.world.scene;

    // Remove created atoms
    const atomMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "atom",
    );
    if (atomMesh) {
      const atomMatrices = getThinInstanceMatrixBuffer(atomMesh);
      const atomColors = getThinInstanceColorBuffer(atomMesh);
      if (!atomMatrices || !atomColors) {
        return this;
      }

      // Remove last N atoms
      const atomsToRemove = this.createdAtomIndices.length;
      const newAtomMatrices = new Float32Array(
        atomMatrices.length - atomsToRemove * 16,
      );
      const newAtomColors = new Float32Array(
        atomColors.length - atomsToRemove * 4,
      );

      newAtomMatrices.set(
        atomMatrices.subarray(0, atomMatrices.length - atomsToRemove * 16),
      );
      newAtomColors.set(
        atomColors.subarray(0, atomColors.length - atomsToRemove * 4),
      );

      // Update mesh
      atomMesh.thinInstanceSetBuffer("matrix", newAtomMatrices, 16, true);
      atomMesh.thinInstanceSetBuffer("color", newAtomColors, 4, true);
    }

    // Remove created bonds
    if (this.createdBondIndices.length > 0) {
      this.removeBonds();
    }

    return this;
  }

  private createBonds(atomIndexOffset: number): void {
    const scene = this.app.world.scene;
    const bondMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "bond",
    );
    if (!bondMesh) {
      return;
    }

    const bondMatrices = getThinInstanceMatrixBuffer(bondMesh);
    if (!bondMatrices) {
      return;
    }

    const newBondMatrices: number[] = [];

    // Get atom positions
    const atomMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "atom",
    );
    if (!atomMesh) return;
    const atomMatrices = getThinInstanceMatrixBuffer(atomMesh);
    if (!atomMatrices) return;

    const baseBondCount = Math.floor(bondMatrices.length / 16);

    for (const bondData of this.clipboardData.bonds) {
      const atomIdx1 = atomIndexOffset + bondData.i;
      const atomIdx2 = atomIndexOffset + bondData.j;

      // Get atom positions
      const offset1 = atomIdx1 * 16;
      const offset2 = atomIdx2 * 16;

      const pos1 = new Vector3(
        atomMatrices[offset1 + 12],
        atomMatrices[offset1 + 13],
        atomMatrices[offset1 + 14],
      );

      const pos2 = new Vector3(
        atomMatrices[offset2 + 12],
        atomMatrices[offset2 + 13],
        atomMatrices[offset2 + 14],
      );

      // Calculate bond transformation
      const bondCenter = Vector3.Center(pos1, pos2);
      const bondVector = pos2.subtract(pos1);
      const bondLength = bondVector.length();

      const up = new Vector3(0, 1, 0);
      const axis = Vector3.Cross(up, bondVector.normalize());
      const angle = Math.acos(Vector3.Dot(up, bondVector.normalize()));

      const rotationMatrix =
        axis.length() > 0.001
          ? BABYLON.Matrix.RotationAxis(axis.normalize(), angle)
          : BABYLON.Matrix.Identity();

      const scaleMatrix = BABYLON.Matrix.Scaling(1, bondLength, 1);
      const translationMatrix = BABYLON.Matrix.Translation(
        bondCenter.x,
        bondCenter.y,
        bondCenter.z,
      );

      const finalMatrix = scaleMatrix
        .multiply(rotationMatrix)
        .multiply(translationMatrix);

      // Add to buffers
      for (let i = 0; i < 16; i++) {
        newBondMatrices.push(finalMatrix.m[i]);
      }

      this.createdBondIndices.push(
        baseBondCount + this.createdBondIndices.length,
      );
    }

    // Extend bond buffers
    const extendedBondMatrices = new Float32Array(
      bondMatrices.length + newBondMatrices.length,
    );
    extendedBondMatrices.set(bondMatrices);
    extendedBondMatrices.set(newBondMatrices, bondMatrices.length);

    // Update mesh
    bondMesh.thinInstanceSetBuffer("matrix", extendedBondMatrices, 16, true);
  }

  private removeBonds(): void {
    const scene = this.app.world.scene;
    const bondMesh = findThinInstanceMesh(
      scene,
      this.app.world.sceneIndex,
      "bond",
    );
    if (!bondMesh) {
      return;
    }

    const bondMatrices = getThinInstanceMatrixBuffer(bondMesh);
    if (!bondMatrices) {
      return;
    }

    const bondsToRemove = this.createdBondIndices.length;

    const newBondMatrices = new Float32Array(
      bondMatrices.length - bondsToRemove * 16,
    );

    newBondMatrices.set(
      bondMatrices.subarray(0, bondMatrices.length - bondsToRemove * 16),
    );

    bondMesh.thinInstanceSetBuffer("matrix", newBondMatrices, 16, true);
  }
}

/**
 * Copy the rows at `indices` out of `source` into `target`, column by column.
 *
 * Dispatches on each column's own dtype, so every column the source carries —
 * `charge`, `mol_id`, a force vector, anything — comes along. Row indices that
 * fall outside the block are skipped.
 */
function gatherRows(source: Block, target: Block, indices: number[]): void {
  const nrows = source.nrows();
  const rows = indices.filter(
    (i) => Number.isInteger(i) && i >= 0 && i < nrows,
  );

  for (const rawKey of source.keys()) {
    const key = String(rawKey);
    switch (source.dtype(key)) {
      case "f32":
      case "f64": {
        const column = source.viewColF(key);
        target.setColF(
          key,
          Float64Array.from(rows, (i) => column[i]),
        );
        break;
      }
      case "i32": {
        const column = source.viewColI32(key);
        target.setColI32(
          key,
          Int32Array.from(rows, (i) => column[i]),
        );
        break;
      }
      case "u32": {
        const column = source.viewColU32(key);
        target.setColU32(
          key,
          Uint32Array.from(rows, (i) => column[i]),
        );
        break;
      }
      case "string": {
        const column = source.copyColStr(key) as string[];
        target.setColStr(
          key,
          rows.map((i) => String(column[i])),
        );
        break;
      }
      // Any other dtype has no molrs-wasm accessor pair; leaving the column
      // out is better than inventing values for it.
    }
  }
}

/**
 * Build a Frame holding just the selected atoms and bonds.
 *
 * A real subset of the live frame, sliced by row index — so every column the
 * scene was built from survives, not only the handful the renderer happens to
 * draw. Bond endpoints are renumbered into the emitted atom subset so the
 * returned Frame stands on its own.
 */
export function getSelectedCommand(app: MolvisApp): { frame: Frame } {
  const selected = new MolrsFrame();
  const source = app.frame;
  if (!source) return { frame: selected };

  const sm = app.world.selectionManager;
  const atomRows = [...sm.getSelectedAtomIds()].sort((a, b) => a - b);
  const bondRows = [...sm.getSelectedBondIds()].sort((a, b) => a - b);

  const sourceAtoms = source.getBlock("atoms");
  if (sourceAtoms && atomRows.length > 0) {
    gatherRows(sourceAtoms, selected.createBlock("atoms"), atomRows);
  }

  const sourceBonds = source.getBlock("bonds");
  if (sourceBonds && bondRows.length > 0) {
    // Endpoints index the full frame, so a bond is only meaningful in the
    // subset when both of its atoms came along. Decide which rows survive
    // *before* gathering, or the remapped endpoint columns would end up
    // shorter than the bond block's other columns.
    const remap = new Map(atomRows.map((row, i) => [row, i]));
    const sourceI = sourceBonds.viewColU32(keys.ATOMI);
    const sourceJ = sourceBonds.viewColU32(keys.ATOMJ);
    const keptRows =
      sourceI && sourceJ
        ? bondRows.filter(
            (row) => remap.has(sourceI[row]) && remap.has(sourceJ[row]),
          )
        : bondRows;

    if (keptRows.length > 0) {
      const bonds = selected.createBlock("bonds");
      gatherRows(sourceBonds, bonds, keptRows);
      if (sourceI && sourceJ) {
        bonds.setColU32(
          keys.ATOMI,
          Uint32Array.from(
            keptRows,
            (row) => remap.get(sourceI[row]) as number,
          ),
        );
        bonds.setColU32(
          keys.ATOMJ,
          Uint32Array.from(
            keptRows,
            (row) => remap.get(sourceJ[row]) as number,
          ),
        );
      }
    }
  }

  return { frame: selected };
}

/**
 * Command to select atoms by their IDs.
 */
@command("select_atoms")
export class SelectAtomByIdCommand extends Command<void> {
  private atomIds: number[];
  private prevSelection: number[];

  constructor(app: MolvisApp, args: { ids: number[] | number }) {
    super(app);
    this.atomIds = Array.isArray(args.ids) ? args.ids : [args.ids];
    this.prevSelection = [];
  }

  do(): void {
    const sm = this.app.world.selectionManager;
    // Backup current selection (only atoms supported for now in this command)
    this.prevSelection = Array.from(sm.getSelectedAtomIds());

    // Clear and select new
    sm.clearSelection();
    sm.selectAtomsByIds(this.atomIds);
  }

  undo(): Command {
    const sm = this.app.world.selectionManager;
    sm.clearSelection();
    sm.selectAtomsByIds(this.prevSelection);
    return this;
  }
}

// Register the command for RPC access
commands.register("get_selected", getSelectedCommand);
