import type { Scene, Mesh } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import type { Frame } from "../core/system/frame";
import type { SceneIndex } from "./scene_index";

/**
 * Synchronize scene data (meshes and thin instances) back to Frame.
 * This function enforces strict ID compliance by using the SceneIndex as the
 * single source of truth for topology, rather than inferring connectivity
 * through geometric proximity.
 * 
 * @param scene The Babylon.js scene containing meshes and thin instances
 * @param sceneIndex The SceneIndex managing metadata and topology
 * @param frame The Frame to synchronize to
 */
export function syncSceneToFrame(scene: Scene, sceneIndex: SceneIndex, frame: Frame): void {
    // Clear the frame
    frame.clear();

    // Mapping from global semantic Atom ID -> New Frame Index (0..N)
    const atomIdToFrameIndex = new Map<number, number>();

    // Lists to populate the new Frame
    const atoms: Array<{ x: number; y: number; z: number; element: string }> = [];
    const bonds: Array<{ atomId1: number; atomId2: number; order: number }> = [];

    // Helper to add atom and record mapping
    const addAtom = (id: number, position: Vector3, element: string) => {
        if (atomIdToFrameIndex.has(id)) {
            console.warn(`[syncSceneToFrame] Duplicate atom ID found: ${id}. Skipping.`);
            return;
        }
        atomIdToFrameIndex.set(id, atoms.length);
        atoms.push({ x: position.x, y: position.y, z: position.z, element });
    };

    // 1. Collect Atoms
    // Iterate over all SceneIndex entries to find atoms (both Meshes and Thin Instances)
    for (const [uid, entry] of sceneIndex.allEntries) {
        if (entry.kind === 'atom') {
            // Edit Mode / Manipulated Atoms (Individual Meshes)
            const mesh = scene.getMeshByUniqueId(uid);
            if (!mesh) {
                console.warn(`[syncSceneToFrame] Stale atom entry in SceneIndex: ${uid}`);
                continue;
            }
            // Use current mesh position
            addAtom(entry.meta.atomId, mesh.position, entry.meta.element);

        } else if (entry.kind === 'frame-atom') {
            // View Mode Atoms (Thin Instances) - Not converted to individual meshes
            // If we are seeing these, it means they weren't manipulated individually.
            // We need to read their current world matrices in case the WHOLE mesh moved?
            // Usually ViewMode don't move indiv atoms, but maybe the object moved.

            const mesh = scene.getMeshByUniqueId(uid) as Mesh;
            if (!mesh || !mesh.hasThinInstances) continue;

            const matrices = mesh.thinInstanceGetWorldMatrices();
            const count = entry.atomBlock.nrows();
            const elements = entry.atomBlock.col_strings('element')!;

            // Reconstruct IDs for thin instances. 
            // In ViewMode, IDs are implicitly 0..N of the original block.
            // However, we need unique IDs if we have multiple blocks?
            // SceneIndex.registerFrame() adds them to topology as 0..N.
            // If we have mixed content, this might clash if not handled carefully.
            // For now, assuming single frame usage as per current app design.

            for (let i = 0; i < count; i++) {
                const element = elements[i];
                let position = new Vector3();

                if (matrices && i < matrices.length) {
                    const matrix = matrices[i];
                    position = Vector3.TransformCoordinates(Vector3.Zero(), matrix);
                } else {
                    // Fallback to original block data if matrix missing (shouldn't happen)
                    position.set(
                        entry.atomBlock.col_f32('x')![i],
                        entry.atomBlock.col_f32('y')![i],
                        entry.atomBlock.col_f32('z')![i]
                    );
                }

                // If mixed with manipulated atoms, we need to ensure ID stability.
                // But typically ManipulateMode converts ALL atoms.
                // So we are likely either ALL Mesh or ALL ThinInstance.
                addAtom(i, position, element);
            }
        }
    }

    // 2. Collect Bonds
    // We rely on SceneIndex metadata which stores Semantic IDs.
    // We map those Semantic IDs to the new Frame indices using atomIdToFrameIndex.
    for (const [_, entry] of sceneIndex.allEntries) {
        if (entry.kind === 'bond') {
            // Edit Mode / Manipulated Bonds
            const { atomId1, atomId2, order } = entry.meta;

            const idx1 = atomIdToFrameIndex.get(atomId1);
            const idx2 = atomIdToFrameIndex.get(atomId2);

            if (idx1 !== undefined && idx2 !== undefined) {
                bonds.push({ atomId1: idx1, atomId2: idx2, order });
            } else {
                console.warn(`[syncSceneToFrame] Bond ${entry.meta.bondId} refers to unknown atoms ${atomId1}, ${atomId2}`);
            }

        } else if (entry.kind === 'frame-bond') {
            // View Mode Bonds (Thin Instances)
            const count = entry.bondBlock.nrows();
            const iAtoms = entry.bondBlock.col_u32('i')!;
            const jAtoms = entry.bondBlock.col_u32('j')!;
            const orders = entry.bondBlock.col_u8('order');

            for (let b = 0; b < count; b++) {
                const atomId1 = iAtoms[b];
                const atomId2 = jAtoms[b];
                const order = orders ? orders[b] : 1;

                const idx1 = atomIdToFrameIndex.get(atomId1);
                const idx2 = atomIdToFrameIndex.get(atomId2);

                if (idx1 !== undefined && idx2 !== undefined) {
                    bonds.push({ atomId1: idx1, atomId2: idx2, order });
                }
            }
        }
    }

    // 3. Populate Frame
    atoms.forEach(atom => {
        frame.addAtom(atom.x, atom.y, atom.z, atom.element);
    });

    bonds.forEach(bond => {
        frame.addBond(bond.atomId1, bond.atomId2, bond.order);
    });

    console.log(`[syncSceneToFrame] Synchronized ${atoms.length} atoms and ${bonds.length} bonds using strict SceneIndex topology.`);
}
