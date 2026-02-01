import { type MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Box, Block } from "molrs-wasm";
import { DrawFrameOption } from "./draw";
import * as BABYLON from "@babylonjs/core";

export interface UpdateFrameResult {
    success: boolean;
    reason?: string;
}

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
    private name?: string;
    private clear: boolean;

    constructor(
        app: MolvisApp,
        args: { name?: string; clear?: boolean }
    ) {
        super(app);
        this.name = args.name;
        this.clear = args.clear ?? true;
    }

    do(): void {
        const index = this.app.world.sceneIndex;
        if (this.clear) {
            index.clear();
            this.app.artist.clear();
        }
        // Logic for "new frame" is mostly structural in SceneIndex if it tracked frames separately.
        // Currently SceneIndex has one "current" collection of meshes.
        // So this command is mostly a "Clear" + "Set Name" placeholder.
        // Or if we want to separate frames, we would need SceneIndex to support multiple active frames.
        // For now, assume single active frame model.
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
        const atomMesh = scene.getMeshByName("atom_base_renderer") as BABYLON.Mesh || scene.getMeshByName("atom_base");
        const bondMesh = scene.getMeshByName("bond_base_renderer") as BABYLON.Mesh || scene.getMeshByName("bond_base");

        if (!atomMesh) {
            return { success: false, reason: "No existing atom mesh found (atom_base_renderer)" };
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
        sceneIndex.registerFrame({
            atomMesh,
            bondMesh: bondMesh || undefined,
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
        const elements = atomsBlock.getColumnStrings("element");

        const existingMatrixBuffer = (mesh as any).thinInstanceGetBuffer("matrix") as Float32Array | null;
        const needsSetMatrix = !existingMatrixBuffer || existingMatrixBuffer.length !== count * 16;
        const matrixBuffer = needsSetMatrix ? new Float32Array(count * 16) : existingMatrixBuffer;

        const existingInstanceData = (mesh as any).thinInstanceGetBuffer("instanceData") as Float32Array | null;
        const needsSetInstanceData = existingInstanceData ? existingInstanceData.length !== count * 4 : false;
        const instanceDataBuffer = existingInstanceData && !needsSetInstanceData ? existingInstanceData : (existingInstanceData ? new Float32Array(count * 4) : null);

        const styleManager = this.app.styleManager;
        const drawOptions = this.options ?? {};
        const styleCache = new Map<string, { radius: number }>();

        for (let i = 0; i < count; i++) {
            const element = elements ? elements[i] : "C";
            let radius = drawOptions.atoms?.radii?.[i];

            // Logic: if radius undefined, check style manager.
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

        const existingMatrix = (mesh as any).thinInstanceGetBuffer("matrix") as Float32Array | null;
        const needsSetMatrix = !existingMatrix || existingMatrix.length !== count * 16;
        const matrixBuffer = needsSetMatrix ? new Float32Array(count * 16) : existingMatrix;

        const existingData0 = (mesh as any).thinInstanceGetBuffer("instanceData0") as Float32Array | null;
        const existingData1 = (mesh as any).thinInstanceGetBuffer("instanceData1") as Float32Array | null;
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
                matrixBuffer[matOffset + 5] = scale;
                matrixBuffer[matOffset + 10] = scale;
                matrixBuffer[matOffset + 15] = 1;
                matrixBuffer[matOffset + 12] = TMP_VEC_CENTER.x;
                matrixBuffer[matOffset + 13] = TMP_VEC_CENTER.y;
                matrixBuffer[matOffset + 14] = TMP_VEC_CENTER.z;
            } else {
                // Fast rotation: quaternion from unit vectors (no acos)
                let dot = BABYLON.Vector3.Dot(UP_VECTOR, TMP_VEC_DIR);
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
        return this;
    }
}

/**
 * Command to dump the current scene frame.
 */
@command("dump_frame")
export class DumpFrameCommand extends Command<{ frameData: Record<string, any> }> {
    do(): { frameData: Record<string, any> } {
        const frame = this.app.world.sceneIndex.dumpFrame();
        // We return the raw frame as a JS object/dict for the RPC layer to serialize
        // The molrs-wasm frame object might need to do to_dict()? 
        // Need to check if `dumpFrame` returns a WASM Frame object.
        // Yes, SceneIndex.dumpFrame returns Frame.

        // However, we cannot return WASM object to python directly via JSON RPC.
        // We must convert to simple object.
        // Since we don't have frame.to_dict exposed in JS interface often?
        // Let's check `Frame` interface in simple view.

        // Actually, the easiest way might be to Write to buffer using `writeFrame` 
        // OR construct a plain object matching what Python expects if we want strict typing.
        // But `writeFrame` (binary) is good. The user requested `mp.Frame` support.
        // `mp.Frame` can be constructed from a dict.

        // Let's allow the RPC layer/serializer to handle `Frame` if it has a `toJSON` or we can map it.
        // WASM objects don't usually map well.
        // I will implement a manual partial dump here OR use writeFrame to binary and send binary?
        // The user requirement "dumpFrame -> mp.Frame" implies we want the structural data.

        // Let's implement a manual conversion to a plain object structure that `molpy` can digest.

        const blocks: Record<string, any> = {};

        // Atoms
        const atomsBlock = frame.getBlock("atoms");
        if (atomsBlock) {
            const nrows = atomsBlock.nrows();
            const x = atomsBlock.getColumnF32("x");
            const y = atomsBlock.getColumnF32("y");
            const z = atomsBlock.getColumnF32("z");
            const elements = atomsBlock.getColumnStrings("element");

            if (x && y && z) {
                blocks["atoms"] = {
                    x: Array.from(x),
                    y: Array.from(y),
                    z: Array.from(z),
                    element: elements ? Array.from(elements) : undefined
                };
            }
        }

        // Bonds
        const bondsBlock = frame.getBlock("bonds");
        if (bondsBlock) {
            const i = bondsBlock.getColumnU32("i");
            const j = bondsBlock.getColumnU32("j");
            const order = bondsBlock.getColumnF32("order");

            if (i && j) {
                blocks["bonds"] = {
                    i: Array.from(i),
                    j: Array.from(j),
                    order: order ? Array.from(order) : undefined
                };
            }
        }

        return { frameData: { blocks } };
    }

    undo(): Command {
        return new NewFrameCommand(this.app, {}); // No-op really
    }
}
