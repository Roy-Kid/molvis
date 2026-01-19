import { Vector3, Mesh } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { Command } from "./base";
import type { SelectedEntity } from "../core/selection_manager";

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
        }
    ) {
        super(app);
        this.selectedEntities = args.selectedEntities;
        this.delta = args.delta;
    }

    do(): void {
        const scene = this.app.world.scene;

        // Store original positions and move atoms
        for (const entity of this.selectedEntities) {
            if (entity.type !== 'atom') continue;

            const mesh = scene.getMeshById(entity.meshId) as Mesh;
            if (!mesh?.metadata?.matrices) continue;

            const matrices = mesh.metadata.matrices as Float32Array;
            const offset = entity.instanceIndex * 16;

            // Store original position
            const key = `${entity.meshId}:${entity.instanceIndex}`;
            this.originalPositions.set(key, new Vector3(
                matrices[offset + 12],
                matrices[offset + 13],
                matrices[offset + 14]
            ));

            // Apply delta
            matrices[offset + 12] += this.delta.x;
            matrices[offset + 13] += this.delta.y;
            matrices[offset + 14] += this.delta.z;

            mesh.thinInstanceBufferUpdated("matrix");
        }

        // Update connected bonds
        this.updateConnectedBonds();
    }

    undo(): Command {
        const scene = this.app.world.scene;

        // Restore original positions
        for (const entity of this.selectedEntities) {
            if (entity.type !== 'atom') continue;

            const mesh = scene.getMeshById(entity.meshId) as Mesh;
            if (!mesh?.metadata?.matrices) continue;

            const key = `${entity.meshId}:${entity.instanceIndex}`;
            const originalPos = this.originalPositions.get(key);
            if (!originalPos) continue;

            const matrices = mesh.metadata.matrices as Float32Array;
            const offset = entity.instanceIndex * 16;

            matrices[offset + 12] = originalPos.x;
            matrices[offset + 13] = originalPos.y;
            matrices[offset + 14] = originalPos.z;

            mesh.thinInstanceBufferUpdated("matrix");
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

        // Get all bond meshes
        const bondMeshes = scene.meshes.filter(m => m.metadata?.meshType === 'bond') as Mesh[];

        for (const bondMesh of bondMeshes) {
            if (!bondMesh.metadata?.matrices || !bondMesh.metadata?.i || !bondMesh.metadata?.j) continue;

            const matrices = bondMesh.metadata.matrices as Float32Array;
            const atomIndices_i = bondMesh.metadata.i as Uint32Array;
            const atomIndices_j = bondMesh.metadata.j as Uint32Array;

            // Get atom mesh (assuming single atom mesh for now)
            const atomMesh = scene.meshes.find(m => m.metadata?.meshType === 'atom') as Mesh;
            if (!atomMesh?.metadata?.matrices) continue;

            const atomMatrices = atomMesh.metadata.matrices as Float32Array;

            // Update each bond instance
            const bondCount = atomIndices_i.length;
            for (let bondIdx = 0; bondIdx < bondCount; bondIdx++) {
                const atomIdx1 = atomIndices_i[bondIdx];
                const atomIdx2 = atomIndices_j[bondIdx];

                // Get atom positions
                const offset1 = atomIdx1 * 16;
                const offset2 = atomIdx2 * 16;

                const pos1 = new Vector3(
                    atomMatrices[offset1 + 12],
                    atomMatrices[offset1 + 13],
                    atomMatrices[offset1 + 14]
                );

                const pos2 = new Vector3(
                    atomMatrices[offset2 + 12],
                    atomMatrices[offset2 + 13],
                    atomMatrices[offset2 + 14]
                );

                // Calculate bond transformation
                const bondCenter = Vector3.Center(pos1, pos2);
                const bondVector = pos2.subtract(pos1);
                const bondLength = bondVector.length();

                // Update bond matrix
                const bondOffset = bondIdx * 16;

                // Calculate rotation to align cylinder with bond vector
                const up = new Vector3(0, 1, 0);
                const axis = Vector3.Cross(up, bondVector.normalize());
                const angle = Math.acos(Vector3.Dot(up, bondVector.normalize()));

                // Build transformation matrix
                const rotationMatrix = axis.length() > 0.001
                    ? BABYLON.Matrix.RotationAxis(axis.normalize(), angle)
                    : BABYLON.Matrix.Identity();

                const scaleMatrix = BABYLON.Matrix.Scaling(1, bondLength, 1);
                const translationMatrix = BABYLON.Matrix.Translation(bondCenter.x, bondCenter.y, bondCenter.z);

                const finalMatrix = scaleMatrix.multiply(rotationMatrix).multiply(translationMatrix);

                // Copy to buffer
                for (let i = 0; i < 16; i++) {
                    matrices[bondOffset + i] = finalMatrix.m[i];
                }
            }

            bondMesh.thinInstanceBufferUpdated("matrix");
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
        }
    ) {
        super(app);
        this.clipboardData = args.clipboardData;
        this.pastePosition = args.pastePosition;
    }

    do(): void {
        const scene = this.app.world.scene;

        // Get atom mesh
        const atomMesh = scene.meshes.find(m => m.metadata?.meshType === 'atom') as Mesh;
        if (!atomMesh?.metadata?.matrices || !atomMesh.metadata?.colorBuffer) {
            console.error("Cannot paste: atom mesh not found");
            return;
        }

        const atomMatrices = atomMesh.metadata.matrices as Float32Array;
        const atomColors = atomMesh.metadata.colorBuffer as Float32Array;
        const atomElements = atomMesh.metadata.elements as string[];

        // Calculate current atom count
        const currentAtomCount = atomMatrices.length / 16;

        // Create new atoms
        const newAtomMatrices: number[] = [];
        const newAtomColors: number[] = [];

        for (const atomData of this.clipboardData.atoms) {
            const absolutePosition = this.pastePosition.add(atomData.relativePosition);

            // Create transformation matrix
            const matrix = BABYLON.Matrix.Translation(
                absolutePosition.x,
                absolutePosition.y,
                absolutePosition.z
            );

            // Add matrix to buffer
            for (let i = 0; i < 16; i++) {
                newAtomMatrices.push(matrix.m[i]);
            }

            // Add color (default white for now, could be element-based)
            newAtomColors.push(1.0, 1.0, 1.0, 1.0);

            // Add element
            atomElements.push(atomData.element);

            // Track created atom index
            this.createdAtomIndices.push(currentAtomCount + this.createdAtomIndices.length);
        }

        // Extend atom buffers
        const extendedAtomMatrices = new Float32Array(atomMatrices.length + newAtomMatrices.length);
        extendedAtomMatrices.set(atomMatrices);
        extendedAtomMatrices.set(newAtomMatrices, atomMatrices.length);

        const extendedAtomColors = new Float32Array(atomColors.length + newAtomColors.length);
        extendedAtomColors.set(atomColors);
        extendedAtomColors.set(newAtomColors, atomColors.length);

        // Update mesh metadata and buffers
        atomMesh.metadata.matrices = extendedAtomMatrices;
        atomMesh.metadata.colorBuffer = extendedAtomColors;
        atomMesh.thinInstanceSetBuffer("matrix", extendedAtomMatrices, 16);
        atomMesh.thinInstanceSetBuffer("color", extendedAtomColors, 4);

        // Create bonds if any
        if (this.clipboardData.bonds.length > 0) {
            this.createBonds(currentAtomCount);
        }
    }

    undo(): Command {
        const scene = this.app.world.scene;

        // Remove created atoms
        const atomMesh = scene.meshes.find(m => m.metadata?.meshType === 'atom') as Mesh;
        if (atomMesh?.metadata?.matrices && atomMesh.metadata?.colorBuffer) {
            const atomMatrices = atomMesh.metadata.matrices as Float32Array;
            const atomColors = atomMesh.metadata.colorBuffer as Float32Array;
            const atomElements = atomMesh.metadata.elements as string[];

            // Remove last N atoms
            const atomsToRemove = this.createdAtomIndices.length;
            const newAtomMatrices = new Float32Array(atomMatrices.length - atomsToRemove * 16);
            const newAtomColors = new Float32Array(atomColors.length - atomsToRemove * 4);

            newAtomMatrices.set(atomMatrices.subarray(0, atomMatrices.length - atomsToRemove * 16));
            newAtomColors.set(atomColors.subarray(0, atomColors.length - atomsToRemove * 4));

            // Remove elements
            atomElements.splice(atomElements.length - atomsToRemove, atomsToRemove);

            // Update mesh
            atomMesh.metadata.matrices = newAtomMatrices;
            atomMesh.metadata.colorBuffer = newAtomColors;
            atomMesh.thinInstanceSetBuffer("matrix", newAtomMatrices, 16);
            atomMesh.thinInstanceSetBuffer("color", newAtomColors, 4);
        }

        // Remove created bonds
        if (this.createdBondIndices.length > 0) {
            this.removeBonds();
        }

        return this;
    }

    private createBonds(atomIndexOffset: number): void {
        const scene = this.app.world.scene;
        const bondMesh = scene.meshes.find(m => m.metadata?.meshType === 'bond') as Mesh;
        if (!bondMesh?.metadata?.matrices || !bondMesh.metadata?.i || !bondMesh.metadata?.j) {
            return;
        }

        const bondMatrices = bondMesh.metadata.matrices as Float32Array;
        const bondIndices_i = bondMesh.metadata.i as Uint32Array;
        const bondIndices_j = bondMesh.metadata.j as Uint32Array;

        const newBondMatrices: number[] = [];
        const newBondIndices_i: number[] = [];
        const newBondIndices_j: number[] = [];

        // Get atom positions
        const atomMesh = scene.meshes.find(m => m.metadata?.meshType === 'atom') as Mesh;
        if (!atomMesh?.metadata?.matrices) return;
        const atomMatrices = atomMesh.metadata.matrices as Float32Array;

        for (const bondData of this.clipboardData.bonds) {
            const atomIdx1 = atomIndexOffset + bondData.i;
            const atomIdx2 = atomIndexOffset + bondData.j;

            // Get atom positions
            const offset1 = atomIdx1 * 16;
            const offset2 = atomIdx2 * 16;

            const pos1 = new Vector3(
                atomMatrices[offset1 + 12],
                atomMatrices[offset1 + 13],
                atomMatrices[offset1 + 14]
            );

            const pos2 = new Vector3(
                atomMatrices[offset2 + 12],
                atomMatrices[offset2 + 13],
                atomMatrices[offset2 + 14]
            );

            // Calculate bond transformation
            const bondCenter = Vector3.Center(pos1, pos2);
            const bondVector = pos2.subtract(pos1);
            const bondLength = bondVector.length();

            const up = new Vector3(0, 1, 0);
            const axis = Vector3.Cross(up, bondVector.normalize());
            const angle = Math.acos(Vector3.Dot(up, bondVector.normalize()));

            const rotationMatrix = axis.length() > 0.001
                ? BABYLON.Matrix.RotationAxis(axis.normalize(), angle)
                : BABYLON.Matrix.Identity();

            const scaleMatrix = BABYLON.Matrix.Scaling(1, bondLength, 1);
            const translationMatrix = BABYLON.Matrix.Translation(bondCenter.x, bondCenter.y, bondCenter.z);

            const finalMatrix = scaleMatrix.multiply(rotationMatrix).multiply(translationMatrix);

            // Add to buffers
            for (let i = 0; i < 16; i++) {
                newBondMatrices.push(finalMatrix.m[i]);
            }

            newBondIndices_i.push(atomIdx1);
            newBondIndices_j.push(atomIdx2);

            this.createdBondIndices.push(bondIndices_i.length + this.createdBondIndices.length);
        }

        // Extend bond buffers
        const extendedBondMatrices = new Float32Array(bondMatrices.length + newBondMatrices.length);
        extendedBondMatrices.set(bondMatrices);
        extendedBondMatrices.set(newBondMatrices, bondMatrices.length);

        const extendedBondIndices_i = new Uint32Array(bondIndices_i.length + newBondIndices_i.length);
        extendedBondIndices_i.set(bondIndices_i);
        extendedBondIndices_i.set(newBondIndices_i, bondIndices_i.length);

        const extendedBondIndices_j = new Uint32Array(bondIndices_j.length + newBondIndices_j.length);
        extendedBondIndices_j.set(bondIndices_j);
        extendedBondIndices_j.set(newBondIndices_j, bondIndices_j.length);

        // Update mesh
        bondMesh.metadata.matrices = extendedBondMatrices;
        bondMesh.metadata.i = extendedBondIndices_i;
        bondMesh.metadata.j = extendedBondIndices_j;
        bondMesh.thinInstanceSetBuffer("matrix", extendedBondMatrices, 16);
    }

    private removeBonds(): void {
        const scene = this.app.world.scene;
        const bondMesh = scene.meshes.find(m => m.metadata?.meshType === 'bond') as Mesh;
        if (!bondMesh?.metadata?.matrices || !bondMesh.metadata?.i || !bondMesh.metadata?.j) {
            return;
        }

        const bondMatrices = bondMesh.metadata.matrices as Float32Array;
        const bondIndices_i = bondMesh.metadata.i as Uint32Array;
        const bondIndices_j = bondMesh.metadata.j as Uint32Array;

        const bondsToRemove = this.createdBondIndices.length;

        const newBondMatrices = new Float32Array(bondMatrices.length - bondsToRemove * 16);
        const newBondIndices_i = new Uint32Array(bondIndices_i.length - bondsToRemove);
        const newBondIndices_j = new Uint32Array(bondIndices_j.length - bondsToRemove);

        newBondMatrices.set(bondMatrices.subarray(0, bondMatrices.length - bondsToRemove * 16));
        newBondIndices_i.set(bondIndices_i.subarray(0, bondIndices_i.length - bondsToRemove));
        newBondIndices_j.set(bondIndices_j.subarray(0, bondIndices_j.length - bondsToRemove));

        bondMesh.metadata.matrices = newBondMatrices;
        bondMesh.metadata.i = newBondIndices_i;
        bondMesh.metadata.j = newBondIndices_j;
        bondMesh.thinInstanceSetBuffer("matrix", newBondMatrices, 16);
    }
}

