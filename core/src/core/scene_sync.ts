import type { Scene, AbstractMesh, Mesh } from "@babylonjs/core";
import type { Frame } from "../core/system/frame";
import type { SceneIndex } from "./scene_index";

/**
 * Synchronize scene data (meshes and thin instances) back to Frame.
 * This is the core function that makes Frame the single source of truth.
 * 
 * @param scene The Babylon.js scene containing meshes and thin instances
 * @param frame The Frame to synchronize to
 */
export function syncSceneToFrame(scene: Scene, sceneIndex: SceneIndex, frame: Frame): void {
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
        const meta = sceneIndex.getMeta(mesh.uniqueId);
        if (!meta || meta.type !== 'atom') return;

        if (!(mesh as Mesh).hasThinInstances) {
            findOrAddAtom(meta.position.x, meta.position.y, meta.position.z, meta.element || 'C');
        }
    });

    // Collect atoms from thin instances (View mode atoms)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const meshWithInstances = mesh as Mesh;
        if (!meshWithInstances.hasThinInstances) return;

        const thinMatrices = meshWithInstances.thinInstanceGetWorldMatrices?.() ?? [];
        for (let i = 0; i < thinMatrices.length; i++) {
            const meta = sceneIndex.getMeta(mesh.uniqueId, i);
            if (!meta || meta.type !== 'atom') continue;

            findOrAddAtom(meta.position.x, meta.position.y, meta.position.z, meta.element || 'C');
        }
    });

    // Collect bonds from individual meshes (Edit mode bonds)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const meta = sceneIndex.getMeta(mesh.uniqueId);
        if (!meta || meta.type !== 'bond') return;

        if ((mesh as Mesh).hasThinInstances) return;

        const { start, end, order } = meta;

        // Find the atoms at the bond endpoints
        const tolerance = 0.1; // Larger tolerance for bond endpoint matching
        const atomId1 = atoms.findIndex(a =>
            Math.abs(a.x - start.x) < tolerance &&
            Math.abs(a.y - start.y) < tolerance &&
            Math.abs(a.z - start.z) < tolerance
        );
        const atomId2 = atoms.findIndex(a =>
            Math.abs(a.x - end.x) < tolerance &&
            Math.abs(a.y - end.y) < tolerance &&
            Math.abs(a.z - end.z) < tolerance
        );

        if (atomId1 !== -1 && atomId2 !== -1) {
            bonds.push({ atomId1, atomId2, order });
        } else {
            console.warn('[syncSceneToFrame] Bond endpoints not found in atoms', { start, end });
        }
    });

    // Collect bonds from thin instances (View mode bonds)
    scene.meshes.forEach((mesh: AbstractMesh) => {
        const meshWithInstances = mesh as Mesh;
        if (!meshWithInstances.hasThinInstances) return;

        const thinMatrices = meshWithInstances.thinInstanceGetWorldMatrices?.() ?? [];
        for (let b = 0; b < thinMatrices.length; b++) {
            const meta = sceneIndex.getMeta(mesh.uniqueId, b);
            if (!meta || meta.type !== 'bond') continue;

            const atomId1 = findOrAddAtom(meta.start.x, meta.start.y, meta.start.z, 'C');
            const atomId2 = findOrAddAtom(meta.end.x, meta.end.y, meta.end.z, 'C');

            bonds.push({ atomId1, atomId2, order: meta.order || 1 });
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
