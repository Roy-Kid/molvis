import type { Scene, AbstractMesh } from "@babylonjs/core";
import { logger } from "../utils/logger";

import type { Frame } from "../core/system/frame";
import type { MeshMetadata } from "../commands/draw";
import { getPositionFromMatrix } from "./thin_instance";

/**
 * Synchronize scene data (meshes and thin instances) back to Frame.
 * This is the core function that makes Frame the single source of truth.
 * 
 * @param scene The Babylon.js scene containing meshes and thin instances
 * @param frame The Frame to synchronize to
 */
export function syncSceneToFrame(scene: Scene, frame: Frame): void {
    // Clear the frame
    frame.clear();

    // Track atom positions and elements for deduplication
    const atoms: Array<{ x: number; y: number; z: number; element: string }> = [];
    const bonds: Array<{ atomId1: number; atomId2: number; order: number }> = [];

    // Helper to find or add atom (returns atom ID)
    const findOrAddAtom = (x: number, y: number, z: number, element: string): number => {
        // Check if atom already exists at this position (within tolerance)
        const tolerance = 0.001;
        const existingIndex = atoms.findIndex(a =>
            Math.abs(a.x - x) < tolerance &&
            Math.abs(a.y - y) < tolerance &&
            Math.abs(a.z - z) < tolerance &&
            a.element === element
        );

        if (existingIndex !== -1) {
            return existingIndex;
        }

        // Add new atom
        atoms.push({ x, y, z, element });
        return atoms.length - 1;
    };

    // Collect atoms from individual meshes (Edit mode atoms)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const metadata = mesh.metadata as MeshMetadata;

        if (metadata?.meshType === 'atom' && !metadata.matrices) {
            // This is an individual atom mesh (not a thin instance base)
            const pos = mesh.position;
            const element = metadata.element || 'C';
            findOrAddAtom(pos.x, pos.y, pos.z, element);
        }
    });

    // Collect atoms from thin instances (View mode atoms)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const metadata = mesh.metadata as MeshMetadata;

        if (metadata?.meshType === 'atom' && metadata.matrices && metadata.atomCount) {
            // This is a thin instance base mesh
            const matrices = metadata.matrices;
            const atomBlock = metadata.atomBlock;

            if (!atomBlock) {
                console.warn('[syncSceneToFrame] Thin instance atom mesh missing atomBlock metadata');
                return;
            }

            for (let i = 0; i < metadata.atomCount; i++) {
                const pos = getPositionFromMatrix(matrices, i);
                const element = atomBlock.element[i] || 'C';
                findOrAddAtom(pos.x, pos.y, pos.z, element);
            }
        }
    });

    // Collect bonds from individual meshes (Edit mode bonds)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const metadata = mesh.metadata as MeshMetadata;

        if (metadata?.meshType === 'bond' && metadata.x1 !== undefined) {
            // This is an individual bond mesh
            const x1 = metadata.x1;
            const y1 = metadata.y1!;
            const z1 = metadata.z1!;
            const x2 = metadata.x2!;
            const y2 = metadata.y2!;
            const z2 = metadata.z2!;
            const order = metadata.order || 1;

            // Find the atoms at the bond endpoints
            const tolerance = 0.1; // Larger tolerance for bond endpoint matching
            const atomId1 = atoms.findIndex(a =>
                Math.abs(a.x - x1) < tolerance &&
                Math.abs(a.y - y1) < tolerance &&
                Math.abs(a.z - z1) < tolerance
            );
            const atomId2 = atoms.findIndex(a =>
                Math.abs(a.x - x2) < tolerance &&
                Math.abs(a.y - y2) < tolerance &&
                Math.abs(a.z - z2) < tolerance
            );

            if (atomId1 !== -1 && atomId2 !== -1) {
                bonds.push({ atomId1, atomId2, order });
            } else {
                console.warn('[syncSceneToFrame] Bond endpoints not found in atoms', { x1, y1, z1, x2, y2, z2 });
            }
        }
    });

    // Collect bonds from thin instances (View mode bonds)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const metadata = mesh.metadata as MeshMetadata;

        if (metadata?.meshType === 'bond' && metadata.i && metadata.j) {
            // This is a thin instance bond mesh
            const iArray = metadata.i;
            const jArray = metadata.j;
            const bondBlock = metadata.bondBlock;
            const atomBlock = metadata.atomBlock;

            if (!bondBlock || !atomBlock) {
                console.warn('[syncSceneToFrame] Thin instance bond mesh missing block metadata');
                return;
            }

            const orderArray = bondBlock.get<Uint8Array>('order', new Uint8Array(iArray.length).fill(1));

            for (let b = 0; b < iArray.length; b++) {
                const i = iArray[b];
                const j = jArray[b];

                // Get atom positions from atomBlock
                const x1 = atomBlock.x[i];
                const y1 = atomBlock.y[i];
                const z1 = atomBlock.z[i];
                const x2 = atomBlock.x[j];
                const y2 = atomBlock.y[j];
                const z2 = atomBlock.z[j];
                const element1 = atomBlock.element[i];
                const element2 = atomBlock.element[j];

                // Find or add atoms
                const atomId1 = findOrAddAtom(x1, y1, z1, element1);
                const atomId2 = findOrAddAtom(x2, y2, z2, element2);

                const order = orderArray[b] || 1;
                bonds.push({ atomId1, atomId2, order });
            }
        }
    });

    // Add all atoms to frame
    atoms.forEach(atom => {
        frame.addAtom(atom.x, atom.y, atom.z, atom.element);
    });

    // Add all bonds to frame
    bonds.forEach(bond => {
        frame.addBond(bond.atomId1, bond.atomId2, bond.order);
    });

    console.log(`[syncSceneToFrame] Synchronized ${atoms.length} atoms and ${bonds.length} bonds to Frame`);
}
