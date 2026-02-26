import * as BABYLON from "@babylonjs/core";
import { type Block, Frame } from "@molcrafts/molrs";
import type { MolvisApp } from "../core/app";
import { syncSceneToFrame } from "../core/scene_sync";
import { Command, command } from "./base";
import type { DrawFrameOption } from "./draw";

export interface UpdateFrameResult {
  success: boolean;
  reason?: string;
}

interface FrameDataBlock {
  x?: number[];
  y?: number[];
  z?: number[];
  element?: string[];
  i?: number[];
  j?: number[];
  order?: number[];
}

type FrameDataBlocks = Record<string, FrameDataBlock>;

// Reusable scratch variables from update_frame.ts
const TMP_VEC_0 = new BABYLON.Vector3();
const TMP_VEC_1 = new BABYLON.Vector3();
const TMP_VEC_2 = new BABYLON.Vector3();
const TMP_VEC_CENTER = new BABYLON.Vector3();
const TMP_VEC_DIR = new BABYLON.Vector3();
const TMP_VEC_AXIS = new BABYLON.Vector3();
const TMP_MAT = BABYLON.Matrix.Identity();
const TMP_QUAT = BABYLON.Quaternion.Identity();
const UP_VECTOR = new BABYLON.Vector3(0, 1, 0);

/**
 * Command to create a new frame and set it as current.
 */
@command("new_frame")
export class NewFrameCommand extends Command<void> {
  private clear: boolean;
  private frameName?: string;

  constructor(app: MolvisApp, args: { name?: string; clear?: boolean }) {
    super(app);
    this.frameName = args.name;
    this.clear = args.clear ?? true;
  }

  do(): void {
    const index = this.app.world.sceneIndex;
    if (this.clear) {
      index.clear();
      this.app.artist.clear();
    }
    // Frame naming is retained for forward compatibility but not persisted in v0.0.2.
    void this.frameName;
  }

  undo(): Command {
    return this; // Cannot undo clear easily without massive state save
  }
}

/**
 * Command to incrementally update the scene with a new frame.
 */
@command("update_frame")
export class UpdateFrameCommand extends Command<UpdateFrameResult> {
  private frame?: Frame;
  private options?: DrawFrameOption;

  constructor(
    app: MolvisApp,
    args: { frame: Frame; options?: DrawFrameOption },
  ) {
    super(app);
    this.frame = args.frame;
    this.options = args.options;
  }

  async do(): Promise<UpdateFrameResult> {
    if (!this.frame) {
      return { success: false, reason: "No frame provided" };
    }

    const sceneIndex = this.app.world.sceneIndex;

    // 1. Get Existing Meshes from Artist (more reliable than scene lookup)
    const atomMesh = this.app.artist.atomMesh;
    const bondMesh = this.app.artist.bondMesh;

    if (!atomMesh) {
      return {
        success: false,
        reason: "No existing atom mesh found",
      };
    }

    // 2. Check Compatibility (Topology)
    const frameAtoms = this.frame.getBlock("atoms");
    if (!frameAtoms) {
      return { success: false, reason: "Frame has no atoms" };
    }

    const currentAtomCount = atomMesh.thinInstanceCount;
    const newAtomCount = frameAtoms.nrows();

    if (currentAtomCount !== newAtomCount) {
      return {
        success: false,
        reason: `Atom count mismatch: current=${currentAtomCount}, new=${newAtomCount}`,
      };
    }

    const frameBonds = this.frame.getBlock("bonds");
    let currentBondCount = 0;
    if (bondMesh) {
      currentBondCount = bondMesh.thinInstanceCount;
    }
    const newBondCount = frameBonds ? frameBonds.nrows() : 0;

    if (currentBondCount !== newBondCount) {
      return {
        success: false,
        reason: `Bond count mismatch: current=${currentBondCount}, new=${newBondCount}`,
      };
    }

    // 3. Update Buffers (in-place, no mesh recreation)
    this.updateAtomBuffer(atomMesh, frameAtoms);

    if (bondMesh && frameBonds) {
      this.updateBondBuffer(bondMesh, frameAtoms, frameBonds);
    }

    // 4. Update Metadata only (don't call registerFrame - it recreates ImpostorState!)
    sceneIndex.metaRegistry.atoms.setFrame(frameAtoms);
    if (frameBonds) {
      sceneIndex.metaRegistry.bonds.setFrame(frameBonds, frameAtoms);
    }

    return { success: true };
  }

  private updateAtomBuffer(mesh: BABYLON.Mesh, atomsBlock: Block) {
    const count = atomsBlock.nrows();
    if (!count) throw new Error("Atoms block has no rows");
    const xCoords = atomsBlock.getColumnF32("x");
    if (!xCoords) throw new Error("Missing x coordinates");
    const yCoords = atomsBlock.getColumnF32("y");
    if (!yCoords) throw new Error("Missing y coordinates");
    const zCoords = atomsBlock.getColumnF32("z");
    if (!zCoords) throw new Error("Missing z coordinates");
    const elements = atomsBlock.getColumnStrings("element");

    // Retrieve Metalayer/ImpostorState from SceneIndex
    const atomState = this.app.world.sceneIndex.meshRegistry.getAtomState();
    if (!atomState || atomState.mesh !== mesh) {
      throw new Error("Atom state not found or mismatched mesh in SceneIndex");
    }

    // Get buffer from ImpostorState
    const matrixDesc = atomState.buffers.get("matrix");
    if (!matrixDesc) throw new Error("Matrix buffer missing in AtomState");

    const matrixBuffer = matrixDesc.data; // Using the persistent buffer
    if (matrixBuffer.length < count * 16) {
      // Buffer too small? We should probably resize via ImpostorState.
      // But UpdateFrameCommand usually assumes topology matches.
      // If count is same, length should be sufficient if ImpostorState was init correctly.
      // But if ImpostorState was grown for Edits, it's fine.
      throw new Error(`Matrix buffer too small: ${matrixBuffer.length} < ${count * 16}`);
    }

    // InstanceData
    const instanceDataDesc = atomState.buffers.get("instanceData");
    if (!instanceDataDesc) throw new Error("InstanceData buffer missing in AtomState");
    const instanceDataBuffer = instanceDataDesc.data;

    const styleManager = this.app.styleManager;
    const drawOptions = this.options ?? {};
    const styleCache = new Map<string, { radius: number }>();

    for (let i = 0; i < count; i++) {
      const element = elements ? elements[i] : "C";
      let radius = drawOptions.atoms?.radii?.[i];

      if (radius === undefined) {
        let style = styleCache.get(element);
        if (!style) {
          const s = styleManager.getAtomStyle(element);
          style = { radius: s.radius };
          styleCache.set(element, style);
        }
        radius = style.radius;
      }

      const scale = radius * 2;
      const offset = i * 16;

      // Re-build matrix
      matrixBuffer[offset + 0] = scale;
      matrixBuffer[offset + 5] = scale;
      matrixBuffer[offset + 10] = scale;
      matrixBuffer[offset + 15] = 1;

      matrixBuffer[offset + 12] = xCoords[i];
      matrixBuffer[offset + 13] = yCoords[i];
      matrixBuffer[offset + 14] = zCoords[i];

      const idx4 = i * 4;
      instanceDataBuffer[idx4 + 0] = xCoords[i];
      instanceDataBuffer[idx4 + 1] = yCoords[i];
      instanceDataBuffer[idx4 + 2] = zCoords[i];
      instanceDataBuffer[idx4 + 3] = radius;
    }

    // Notify ImpostorState that we modified the data?
    // ImpostorState.updateMulti? Use setFrameDataAndFlush? 
    // Simply calling thinInstanceBufferUpdated on mesh is enough IF we modified the array it uses.
    // Babylon's ThinInstanceSetBuffer uses the array reference if not static?
    // Wait, ImpostorState calls `thinInstanceSetBuffer(..., true)`.
    // Static buffers might need explicit update call.

    // Flush via ImpostorState
    atomState.dirty = true;
    atomState.flush();
    mesh.thinInstanceRefreshBoundingInfo(true);
  }

  private updateBondBuffer(
    mesh: BABYLON.Mesh,
    atomsBlock: Block,
    bondsBlock: Block,
  ) {
    const count = bondsBlock.nrows();
    if (!count) throw new Error("Bonds block has no rows");
    const xCoords = atomsBlock.getColumnF32("x");
    if (!xCoords) throw new Error("Missing x coordinates");
    const yCoords = atomsBlock.getColumnF32("y");
    if (!yCoords) throw new Error("Missing y coordinates");
    const zCoords = atomsBlock.getColumnF32("z");
    if (!zCoords) throw new Error("Missing z coordinates");
    const i_atoms = bondsBlock.getColumnU32("i");
    if (!i_atoms) throw new Error("Missing bond i atoms");
    const j_atoms = bondsBlock.getColumnU32("j");
    if (!j_atoms) throw new Error("Missing bond j atoms");

    // Retrieve Bond State
    const bondState = this.app.world.sceneIndex.meshRegistry.getBondState();
    if (!bondState || bondState.mesh !== mesh) {
      throw new Error("Bond state not found or mismatched mesh");
    }

    const matrixBuffer = bondState.buffers.get("matrix")?.data;
    if (!matrixBuffer) throw new Error("Bond matrix buffer missing");

    const data0Buffer = bondState.buffers.get("instanceData0")?.data;
    const data1Buffer = bondState.buffers.get("instanceData1")?.data;
    const useImpostor = !!(data0Buffer && data1Buffer);

    const drawOptions = this.options ?? {};
    const bondRadius = drawOptions.bonds?.radii ?? 0.1;

    for (let b = 0; b < count; b++) {
      const i = i_atoms[b];
      const j = j_atoms[b];

      TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]); // p1
      TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]); // p2

      // center = (p1 + p2) * 0.5
      TMP_VEC_CENTER.copyFrom(TMP_VEC_1)
        .addInPlace(TMP_VEC_2)
        .scaleInPlace(0.5);

      // direction = (p2 - p1).normalize()
      TMP_VEC_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1);
      const distance = TMP_VEC_DIR.length();
      if (distance > 1e-8) {
        TMP_VEC_DIR.scaleInPlace(1 / distance);
      } else {
        TMP_VEC_DIR.set(0, 1, 0);
      }

      if (useImpostor && data0Buffer && data1Buffer) {
        const idx4 = b * 4;
        data0Buffer[idx4 + 0] = TMP_VEC_CENTER.x;
        data0Buffer[idx4 + 1] = TMP_VEC_CENTER.y;
        data0Buffer[idx4 + 2] = TMP_VEC_CENTER.z;
        data0Buffer[idx4 + 3] = bondRadius;

        data1Buffer[idx4 + 0] = TMP_VEC_DIR.x;
        data1Buffer[idx4 + 1] = TMP_VEC_DIR.y;
        data1Buffer[idx4 + 2] = TMP_VEC_DIR.z;
        data1Buffer[idx4 + 3] = distance;

        const matOffset = b * 16;
        const scale = distance + bondRadius * 2;
        matrixBuffer[matOffset + 0] = scale;
        matrixBuffer[matOffset + 5] = scale;
        matrixBuffer[matOffset + 10] = scale;
        matrixBuffer[matOffset + 15] = 1;
        matrixBuffer[matOffset + 12] = TMP_VEC_CENTER.x;
        matrixBuffer[matOffset + 13] = TMP_VEC_CENTER.y;
        matrixBuffer[matOffset + 14] = TMP_VEC_CENTER.z;
      } else {
        // Fast rotation
        const dot = BABYLON.Vector3.Dot(UP_VECTOR, TMP_VEC_DIR);
        if (dot < -0.999999) {
          BABYLON.Quaternion.FromEulerAnglesToRef(Math.PI, 0, 0, TMP_QUAT);
        } else {
          BABYLON.Vector3.CrossToRef(UP_VECTOR, TMP_VEC_DIR, TMP_VEC_AXIS);
          TMP_QUAT.x = TMP_VEC_AXIS.x;
          TMP_QUAT.y = TMP_VEC_AXIS.y;
          TMP_QUAT.z = TMP_VEC_AXIS.z;
          TMP_QUAT.w = 1 + dot;
          TMP_QUAT.normalize();
        }

        TMP_VEC_0.set(bondRadius * 2, distance, bondRadius * 2);
        BABYLON.Matrix.ComposeToRef(
          TMP_VEC_0,
          TMP_QUAT,
          TMP_VEC_CENTER,
          TMP_MAT,
        );

        TMP_MAT.copyToArray(matrixBuffer, b * 16);
      }
    }

    // Flush via ImpostorState
    bondState.dirty = true;
    bondState.flush();
    mesh.thinInstanceRefreshBoundingInfo(true);
  }

  undo(): Command {
    return this;
  }
}

/**
 * Command to export current staged scene data as a plain frame-data payload.
 * Intended for external clients (e.g. python) to reconstruct frame objects.
 */
@command("export_frame")
export class ExportFrameCommand extends Command<{
  frameData: { blocks: FrameDataBlocks; metadata: Record<string, unknown> };
}> {
  do(): {
    frameData: { blocks: FrameDataBlocks; metadata: Record<string, unknown> };
  } {
    const tempFrame = new Frame();
    syncSceneToFrame(this.app.world.sceneIndex, tempFrame, {
      markSaved: false,
    });

    const blocks: FrameDataBlocks = {};

    const atomsBlock = tempFrame.getBlock("atoms");
    if (atomsBlock) {
      const x = atomsBlock.getColumnF32("x");
      const y = atomsBlock.getColumnF32("y");
      const z = atomsBlock.getColumnF32("z");
      const elements = atomsBlock.getColumnStrings("element");

      if (x && y && z) {
        blocks.atoms = {
          x: Array.from(x),
          y: Array.from(y),
          z: Array.from(z),
          element: elements ? Array.from(elements) : undefined,
        };
      }
    }

    const bondsBlock = tempFrame.getBlock("bonds");
    if (bondsBlock) {
      const i = bondsBlock.getColumnU32("i");
      const j = bondsBlock.getColumnU32("j");
      const orderU8 = bondsBlock.getColumnU8("order");
      const orderF32 = bondsBlock.getColumnF32("order");

      if (i && j) {
        blocks.bonds = {
          i: Array.from(i),
          j: Array.from(j),
          order: orderU8
            ? Array.from(orderU8)
            : orderF32
              ? Array.from(orderF32)
              : undefined,
        };
      }
    }

    return { frameData: { blocks, metadata: {} } };
  }

  undo(): Command {
    return this;
  }
}
