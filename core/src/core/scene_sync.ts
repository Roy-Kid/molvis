import type { Scene, Mesh } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { Frame, Block } from "molrs-wasm";
import type { SceneIndex } from "./scene_index";

/**
 * Synchronize scene data (meshes and thin instances) back to Frame.
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
    for (const [uid, entry] of sceneIndex.allEntries) {
        if (entry.kind === 'atom') {
            const mesh = scene.getMeshByUniqueId(uid);
            if (!mesh) {
                console.warn(`[syncSceneToFrame] Stale atom entry in SceneIndex: ${uid}`);
                continue;
            }
            addAtom(entry.meta.atomId, mesh.position, entry.meta.element);

        } else if (entry.kind === 'frame-atom') {
            const mesh = scene.getMeshByUniqueId(uid) as Mesh;
            if (!mesh || !mesh.hasThinInstances) continue;

            const matrices = mesh.thinInstanceGetWorldMatrices();
            const count = entry.atomBlock.nrows()!;
            const elements = entry.atomBlock.getColumnStrings('element')!;

            for (let i = 0; i < count; i++) {
                const element = elements[i];
                let position = new Vector3();

                if (matrices && i < matrices.length) {
                    const matrix = matrices[i];
                    position = Vector3.TransformCoordinates(Vector3.Zero(), matrix);
                } else {
                    position.set(
                        entry.atomBlock.getColumnF32('x')![i],
                        entry.atomBlock.getColumnF32('y')![i],
                        entry.atomBlock.getColumnF32('z')![i]
                    );
                }

                addAtom(i, position, element);
            }
        }
    }

    // 2. Collect Bonds
    for (const [_, entry] of sceneIndex.allEntries) {
        if (entry.kind === 'bond') {
            const { atomId1, atomId2, order } = entry.meta;

            const idx1 = atomIdToFrameIndex.get(atomId1);
            const idx2 = atomIdToFrameIndex.get(atomId2);

            if (idx1 !== undefined && idx2 !== undefined) {
                bonds.push({ atomId1: idx1, atomId2: idx2, order });
            } else {
                console.warn(`[syncSceneToFrame] Bond ${entry.meta.bondId} refers to unknown atoms ${atomId1}, ${atomId2}`);
            }

        } else if (entry.kind === 'frame-bond') {
            const count = entry.bondBlock.nrows()!;
            const iAtoms = entry.bondBlock.getColumnU32('i')!;
            const jAtoms = entry.bondBlock.getColumnU32('j')!;
            const orders = entry.bondBlock.getColumnU8('order');

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

    // 3. Populate Frame using Blocks
    const atomCount = atoms.length;
    if (atomCount > 0) {
        const atomBlock = new Block();
        const x = new Float32Array(atomCount);
        const y = new Float32Array(atomCount);
        const z = new Float32Array(atomCount);
        const elements: string[] = [];

        atoms.forEach((atom, i) => {
            x[i] = atom.x;
            y[i] = atom.y;
            z[i] = atom.z;
            elements.push(atom.element);
        });

        atomBlock.setColumnF32('x', x, undefined);
        atomBlock.setColumnF32('y', y, undefined);
        atomBlock.setColumnF32('z', z, undefined);
        atomBlock.setColumnStrings('element', elements, undefined);

        frame.insertBlock('atoms', atomBlock);
    }

    const bondCount = bonds.length;
    if (bondCount > 0) {
        const bondBlock = new Block();
        const iArr = new Uint32Array(bondCount);
        const jArr = new Uint32Array(bondCount);
        const orderArr = new Uint8Array(bondCount);

        bonds.forEach((bond, idx) => {
            iArr[idx] = bond.atomId1;
            jArr[idx] = bond.atomId2;
            orderArr[idx] = bond.order;
        });

        bondBlock.setColumnU32('i', iArr, undefined);
        bondBlock.setColumnU32('j', jArr, undefined);
        bondBlock.setColumnU8('order', orderArr, undefined);

        frame.insertBlock('bonds', bondBlock);
    }

    console.log(`[syncSceneToFrame] Synchronized ${atomCount} atoms and ${bondCount} bonds using strict SceneIndex topology.`);
    sceneIndex.markAllSaved();
}
