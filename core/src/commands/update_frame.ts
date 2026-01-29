import * as BABYLON from "@babylonjs/core";
import { type MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Block } from "molrs-wasm";

import { DrawFrameOption } from "./draw";

// Reusable scratch variables to avoid GC in tight loops
const TMP_VEC_0 = new BABYLON.Vector3();
const TMP_VEC_1 = new BABYLON.Vector3();
const TMP_VEC_2 = new BABYLON.Vector3();
const TMP_VEC_CENTER = new BABYLON.Vector3();
const TMP_VEC_DIR = new BABYLON.Vector3();
const TMP_VEC_AXIS = new BABYLON.Vector3();
const TMP_MAT = BABYLON.Matrix.Identity();
const TMP_QUAT = BABYLON.Quaternion.Identity();
const UP_VECTOR = new BABYLON.Vector3(0, 1, 0);

export interface UpdateFrameResult {
    success: boolean;
    reason?: string;
}

/**
 * Command to incrementally update the scene with a new frame.
 * Optimized for trajectory playback where topology is constant.
 */
@command("update_frame")
export class UpdateFrameCommand extends Command<UpdateFrameResult> {
    private frame?: Frame;
    private options?: DrawFrameOption;

    constructor(app: MolvisApp, args: { frame: Frame; options?: DrawFrameOption }) {
        super(app);
        this.frame = args.frame;
        this.options = args.options;
    }

    async do(): Promise<UpdateFrameResult> {
        if (!this.frame) {
            return { success: false, reason: "No frame provided" };
        }

        const scene = this.app.world.scene;
        const sceneIndex = this.app.world.sceneIndex;

        // 1. Get Existing Meshes
        // We assume standard names for now as per DrawFrameCommand
        const atomMesh = scene.getMeshByName("atom_base") as BABYLON.Mesh;
        const bondMesh = scene.getMeshByName("bond_base") as BABYLON.Mesh;

        if (!atomMesh) {
            return { success: false, reason: "No existing atom mesh found" };
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
                reason: `Atom count mismatch: current=${currentAtomCount}, new=${newAtomCount}`
            };
        }

        // TODO: Check elements compatibility if we want to be strict
        // For now, assuming count equality is enough for "try update"

        const frameBonds = this.frame.getBlock("bonds");
        let currentBondCount = 0;
        if (bondMesh) {
            currentBondCount = bondMesh.thinInstanceCount;
        }
        const newBondCount = frameBonds ? frameBonds.nrows() : 0;

        if (currentBondCount !== newBondCount) {
            return {
                success: false,
                reason: `Bond count mismatch: current=${currentBondCount}, new=${newBondCount}`
            };
        }

        // 3. Update Buffers
        this.updateAtomBuffer(atomMesh, frameAtoms);

        if (bondMesh && frameBonds) {
            this.updateBondBuffer(bondMesh, frameAtoms, frameBonds);
        }

        // 4. Update Metadata in SceneIndex
        // We need to update the source frame info in SceneIndex so picking works correctly with new positions?
        // Actually, SceneIndex stores "Frame" related metadata often by reference or index.
        // If specific per-atom metadata needs updating (like position in SceneIndex cache), do it here.
        // Currently SceneIndex registers the WHOLE frame.
        // So we should re-register the frame to keep sceneIndex up to date with the "active" frame data.

        sceneIndex.registerFrame({
            atomMesh,
            bondMesh,
            atomBlock: frameAtoms,
            bondBlock: frameBonds ?? undefined
        });

        return { success: true };
    }

    private updateAtomBuffer(mesh: BABYLON.Mesh, atomsBlock: Block) {
        const count = atomsBlock.nrows()!;
        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;

        // We need to preserve current scaling!
        // The matrix buffer is 16 floats per instance.
        // [Sx, 0, 0, 0,
        //  0, Sy, 0, 0,
        //  0, 0, Sz, 0,
        //  Tx, Ty, Tz, 1]

        // Ideally we read the existing buffer to keep scales.
        // But getting the buffer back from GPU might be slow or complex?
        // BabylonJS stores it in `mesh._thinInstanceDataStorage.matrixData` if we are lucky?
        // Or we can just re-calculate scale from style manager if we assume standard styles.
        // Let's assume standard styles for now to be fast.

        // Better: Use `thinInstanceSetBuffer` with stride? 
        // Babylon allows updating parts? No, it replaces the buffer.

        // Let's try to reconstruct the buffer.
        // We need element types for radius/scale.
        const elements = atomsBlock.getColumnStrings("element");
        // Fallback or use what's there?
        // If we want to be super fast, maybe we don't change scale.
        // BUT, if we don't have the old scale, we are stuck.

        const existingMatrixBuffer = mesh.thinInstanceGetBuffer("matrix");
        const needsSetMatrix = !existingMatrixBuffer || existingMatrixBuffer.length !== count * 16;
        const matrixBuffer = needsSetMatrix ? new Float32Array(count * 16) : existingMatrixBuffer;
        const existingInstanceData = mesh.thinInstanceGetBuffer("instanceData");
        const needsSetInstanceData = existingInstanceData ? existingInstanceData.length !== count * 4 : false;
        const instanceDataBuffer = existingInstanceData && !needsSetInstanceData ? existingInstanceData : (existingInstanceData ? new Float32Array(count * 4) : null);
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
            matrixBuffer[offset + 1] = 0;
            matrixBuffer[offset + 2] = 0;
            matrixBuffer[offset + 3] = 0;
            matrixBuffer[offset + 4] = 0;
            matrixBuffer[offset + 5] = scale;
            matrixBuffer[offset + 6] = 0;
            matrixBuffer[offset + 7] = 0;
            matrixBuffer[offset + 8] = 0;
            matrixBuffer[offset + 9] = 0;
            matrixBuffer[offset + 10] = scale;
            matrixBuffer[offset + 11] = 0;
            matrixBuffer[offset + 15] = 1;

            matrixBuffer[offset + 12] = xCoords[i];
            matrixBuffer[offset + 13] = yCoords[i];
            matrixBuffer[offset + 14] = zCoords[i];

            if (instanceDataBuffer) {
                const idx4 = i * 4;
                instanceDataBuffer[idx4 + 0] = xCoords[i];
                instanceDataBuffer[idx4 + 1] = yCoords[i];
                instanceDataBuffer[idx4 + 2] = zCoords[i];
                instanceDataBuffer[idx4 + 3] = radius;
            }
        }

        if (needsSetMatrix) {
            mesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        } else {
            mesh.thinInstanceBufferUpdated("matrix");
        }
        if (instanceDataBuffer) {
            if (needsSetInstanceData) {
                mesh.thinInstanceSetBuffer("instanceData", instanceDataBuffer, 4, true);
            } else {
                mesh.thinInstanceBufferUpdated("instanceData");
            }
        }
        mesh.thinInstanceRefreshBoundingInfo(true);
    }

    private updateBondBuffer(mesh: BABYLON.Mesh, atomsBlock: Block, bondsBlock: Block) {
        const count = bondsBlock.nrows()!;
        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        const i_atoms = bondsBlock.getColumnU32("i")!;
        const j_atoms = bondsBlock.getColumnU32("j")!;

        const existingMatrix = mesh.thinInstanceGetBuffer("matrix");
        const needsSetMatrix = !existingMatrix || existingMatrix.length !== count * 16;
        const matrixBuffer = needsSetMatrix ? new Float32Array(count * 16) : existingMatrix;
        const existingData0 = mesh.thinInstanceGetBuffer("instanceData0");
        const existingData1 = mesh.thinInstanceGetBuffer("instanceData1");
        const useImpostor = !!(existingData0 && existingData1);
        const needsSetData0 = useImpostor && existingData0!.length !== count * 4;
        const needsSetData1 = useImpostor && existingData1!.length !== count * 4;
        const data0Buffer = useImpostor ? (needsSetData0 ? new Float32Array(count * 4) : existingData0!) : null;
        const data1Buffer = useImpostor ? (needsSetData1 ? new Float32Array(count * 4) : existingData1!) : null;
        const drawOptions = this.options ?? {};
        const bondRadius = drawOptions.bonds?.radii ?? 0.1;

        for (let b = 0; b < count; b++) {
            const i = i_atoms[b];
            const j = j_atoms[b];

            TMP_VEC_1.set(xCoords[i], yCoords[i], zCoords[i]); // p1
            TMP_VEC_2.set(xCoords[j], yCoords[j], zCoords[j]); // p2

            // center = (p1 + p2) * 0.5
            TMP_VEC_CENTER.copyFrom(TMP_VEC_1).addInPlace(TMP_VEC_2).scaleInPlace(0.5);

            // direction = (p2 - p1).normalize()
            TMP_VEC_DIR.copyFrom(TMP_VEC_2).subtractInPlace(TMP_VEC_1);
            const distance = TMP_VEC_DIR.length();
            if (distance > 1e-8) {
                TMP_VEC_DIR.scaleInPlace(1 / distance);
            } else {
                TMP_VEC_DIR.set(0, 1, 0);
            }

            if (useImpostor) {
                const idx4 = b * 4;
                data0Buffer![idx4 + 0] = TMP_VEC_CENTER.x;
                data0Buffer![idx4 + 1] = TMP_VEC_CENTER.y;
                data0Buffer![idx4 + 2] = TMP_VEC_CENTER.z;
                data0Buffer![idx4 + 3] = bondRadius;

                data1Buffer![idx4 + 0] = TMP_VEC_DIR.x;
                data1Buffer![idx4 + 1] = TMP_VEC_DIR.y;
                data1Buffer![idx4 + 2] = TMP_VEC_DIR.z;
                data1Buffer![idx4 + 3] = distance;

                const matOffset = b * 16;
                const scale = distance + bondRadius * 2;
                matrixBuffer[matOffset + 0] = scale;
                matrixBuffer[matOffset + 1] = 0;
                matrixBuffer[matOffset + 2] = 0;
                matrixBuffer[matOffset + 3] = 0;
                matrixBuffer[matOffset + 4] = 0;
                matrixBuffer[matOffset + 5] = scale;
                matrixBuffer[matOffset + 6] = 0;
                matrixBuffer[matOffset + 7] = 0;
                matrixBuffer[matOffset + 8] = 0;
                matrixBuffer[matOffset + 9] = 0;
                matrixBuffer[matOffset + 10] = scale;
                matrixBuffer[matOffset + 11] = 0;
                matrixBuffer[matOffset + 12] = TMP_VEC_CENTER.x;
                matrixBuffer[matOffset + 13] = TMP_VEC_CENTER.y;
                matrixBuffer[matOffset + 14] = TMP_VEC_CENTER.z;
                matrixBuffer[matOffset + 15] = 1;
            } else {
                // Fast rotation: quaternion from unit vectors (no acos)
                let dot = BABYLON.Vector3.Dot(UP_VECTOR, TMP_VEC_DIR);
                if (dot < -0.999999) {
                    // Anti-parallel, flip 180 deg around X
                    BABYLON.Quaternion.FromEulerAnglesToRef(Math.PI, 0, 0, TMP_QUAT);
                } else {
                    BABYLON.Vector3.CrossToRef(UP_VECTOR, TMP_VEC_DIR, TMP_VEC_AXIS);
                    TMP_QUAT.x = TMP_VEC_AXIS.x;
                    TMP_QUAT.y = TMP_VEC_AXIS.y;
                    TMP_QUAT.z = TMP_VEC_AXIS.z;
                    TMP_QUAT.w = 1 + dot;
                    TMP_QUAT.normalize();
                }

                // Re-compose matrix
                TMP_VEC_0.set(bondRadius * 2, distance, bondRadius * 2);
                BABYLON.Matrix.ComposeToRef(
                    TMP_VEC_0,
                    TMP_QUAT,
                    TMP_VEC_CENTER,
                    TMP_MAT
                );

                TMP_MAT.copyToArray(matrixBuffer, b * 16);
            }
        }

        if (needsSetMatrix) {
            mesh.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true);
        } else {
            mesh.thinInstanceBufferUpdated("matrix");
        }
        if (useImpostor) {
            if (needsSetData0) {
                mesh.thinInstanceSetBuffer("instanceData0", data0Buffer!, 4, true);
            } else {
                mesh.thinInstanceBufferUpdated("instanceData0");
            }
            if (needsSetData1) {
                mesh.thinInstanceSetBuffer("instanceData1", data1Buffer!, 4, true);
            } else {
                mesh.thinInstanceBufferUpdated("instanceData1");
            }
        }
        mesh.thinInstanceRefreshBoundingInfo(true);
    }

    undo(): Command {
        // Undo for update is complex - we'd need the previous state.
        // For playback commands, usually we don't undo/redo in the traditional stack sense,
        // or we just re-run the command for the previous frame index.
        return this;
    }
}
