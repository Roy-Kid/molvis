import * as BABYLON from "@babylonjs/core";
import { type MolvisApp } from "../core/app";
import { Command, command } from "./base";
import { Frame, Block } from "molrs-wasm";

import { DrawFrameOption } from "./draw";

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

        const buffer = new Float32Array(count * 16);
        const styleManager = this.app.styleManager;
        const drawOptions = this.options ?? {};

        for (let i = 0; i < count; i++) {
            const element = elements ? elements[i] : "C";
            // Re-fetch style (fast enough?)
            const style = styleManager.getAtomStyle(element);
            const radius = drawOptions.atoms?.radii?.[i] ?? style.radius;
            const scale = radius * 2;

            const offset = i * 16;

            // Re-build matrix
            buffer[offset + 0] = scale;
            buffer[offset + 5] = scale;
            buffer[offset + 10] = scale;
            buffer[offset + 15] = 1;

            buffer[offset + 12] = xCoords[i];
            buffer[offset + 13] = yCoords[i];
            buffer[offset + 14] = zCoords[i];
        }

        mesh.thinInstanceSetBuffer("matrix", buffer, 16, true);
        mesh.thinInstanceRefreshBoundingInfo(true);
    }

    private updateBondBuffer(mesh: BABYLON.Mesh, atomsBlock: Block, bondsBlock: Block) {
        const count = bondsBlock.nrows()!;
        const xCoords = atomsBlock.getColumnF32("x")!;
        const yCoords = atomsBlock.getColumnF32("y")!;
        const zCoords = atomsBlock.getColumnF32("z")!;
        const i_atoms = bondsBlock.getColumnU32("i")!;
        const j_atoms = bondsBlock.getColumnU32("j")!;

        const buffer = new Float32Array(count * 16);
        const drawOptions = this.options ?? {};
        const bondRadius = drawOptions.bonds?.radii ?? 0.1;

        const tempMatrix = BABYLON.Matrix.Identity();
        const up = new BABYLON.Vector3(0, 1, 0);

        for (let b = 0; b < count; b++) {
            const i = i_atoms[b];
            const j = j_atoms[b];

            const p1 = new BABYLON.Vector3(xCoords[i], yCoords[i], zCoords[i]);
            const p2 = new BABYLON.Vector3(xCoords[j], yCoords[j], zCoords[j]);

            const distance = BABYLON.Vector3.Distance(p1, p2);
            const center = p1.add(p2).scale(0.5);
            const direction = p2.subtract(p1).normalize();

            // Calculate rotation
            const axis = BABYLON.Vector3.Cross(up, direction);
            const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));

            let rotation = BABYLON.Quaternion.Identity();

            if (Math.abs(angle) < 0.0001) {
            } else if (Math.abs(angle - Math.PI) < 0.0001) {
                rotation = BABYLON.Quaternion.FromEulerAngles(Math.PI, 0, 0);
            } else {
                rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
            }

            // Re-compose matrix
            BABYLON.Matrix.ComposeToRef(
                new BABYLON.Vector3(bondRadius * 2, distance, bondRadius * 2),
                rotation,
                center,
                tempMatrix
            );

            tempMatrix.copyToArray(buffer, b * 16);
        }

        mesh.thinInstanceSetBuffer("matrix", buffer, 16, true);
        mesh.thinInstanceRefreshBoundingInfo(true);
    }

    undo(): Command {
        // Undo for update is complex - we'd need the previous state.
        // For playback commands, usually we don't undo/redo in the traditional stack sense,
        // or we just re-run the command for the previous frame index.
        return this;
    }
}
