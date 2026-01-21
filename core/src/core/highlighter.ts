import type { Scene, Mesh, Material } from "@babylonjs/core";
import { StandardMaterial, Color3 } from "@babylonjs/core";
import { type SelectionState, parseSelectionKey } from "./selection_manager";

/**
 * Highlighter: Mode-aware highlighting in a single module.
 * Handles both thin instances (colorBuffer) and meshes (materials).
 * 
 * Responsibilities:
 * - Apply highlights based on selection state
 * - Restore original colors/materials on deselect
 * - Handle mode switches (invalidate and rebuild)
 */
export class Highlighter {
    private scene: Scene;

    // Sparse storage for thin instance original colors
    // Key: `${uniqueId}:${thinIndex}`
    private thinOriginalColors = new Map<string, { r: number; g: number; b: number; a: number }>();

    // Storage for mesh original materials
    // Key: uniqueId
    private meshOriginalMaterials = new Map<number, Material | null>();

    // Shared highlight material for meshes
    private highlightMaterial: StandardMaterial;

    constructor(scene: Scene) {
        this.scene = scene;

        // Create shared highlight material
        this.highlightMaterial = new StandardMaterial("highlight", scene);
        this.highlightMaterial.diffuseColor = Color3.Yellow();
        this.highlightMaterial.emissiveColor = new Color3(0.5, 0.5, 0);
    }

    /**
     * Highlight all selected entities.
     * 
     * @param state - The current selection state
     */
    highlightSelection(state: SelectionState): void {
        this.clearAll();

        // Highlight atoms
        for (const key of state.atoms) {
            const ref = parseSelectionKey(key);
            if (!ref) continue;

            const mesh = this.scene.getMeshByUniqueId(ref.meshId) as Mesh;
            if (!mesh) continue;

            if (ref.subIndex !== undefined) {
                this.highlightThinInstance(mesh, ref.subIndex);
            } else {
                this.highlightMesh(mesh);
            }
        }

        // Highlight bonds
        for (const key of state.bonds) {
            const ref = parseSelectionKey(key);
            if (!ref) continue;

            const mesh = this.scene.getMeshByUniqueId(ref.meshId) as Mesh;
            if (!mesh) continue;

            if (ref.subIndex !== undefined) {
                this.highlightThinInstance(mesh, ref.subIndex);
            } else {
                this.highlightMesh(mesh);
            }
        }
    }

    /**
     * Highlight a thin instance by modifying its color in the colorBuffer.
     * 
     * @param mesh - The thin instance mesh
     * @param thinIndex - The thin instance index
     */
    private highlightThinInstance(mesh: Mesh, thinIndex: number): void {
        const colorBuffer = this.getThinInstanceColorBuffer(mesh);
        if (!colorBuffer) return;

        const offset = thinIndex * 4;
        const key = `${mesh.uniqueId}:${thinIndex}`;

        // Store original color (sparse)
        this.thinOriginalColors.set(key, {
            r: colorBuffer[offset],
            g: colorBuffer[offset + 1],
            b: colorBuffer[offset + 2],
            a: colorBuffer[offset + 3]
        });

        // Apply yellow highlight
        colorBuffer[offset] = 1.0;
        colorBuffer[offset + 1] = 1.0;
        colorBuffer[offset + 2] = 0.0;
        colorBuffer[offset + 3] = 1.0;

        // CRITICAL: Must call thinInstanceSetBuffer to update, not just thinInstanceBufferUpdated
        mesh.thinInstanceSetBuffer("color", colorBuffer, 4, false);
    }

    /**
     * Highlight a mesh by swapping its material.
     * 
     * @param mesh - The mesh to highlight
     */
    private highlightMesh(mesh: Mesh): void {
        this.meshOriginalMaterials.set(mesh.uniqueId, mesh.material);
        mesh.material = this.highlightMaterial;
    }

    /**
     * Clear all highlights and restore original colors/materials.
     */
    clearAll(): void {
        // Restore thin instance colors
        for (const [key, color] of this.thinOriginalColors) {
            const [uniqueIdStr, thinIndexStr] = key.split(':');
            const uniqueId = parseInt(uniqueIdStr);
            const thinIndex = parseInt(thinIndexStr);

            const mesh = this.scene.getMeshByUniqueId(uniqueId) as Mesh;
            if (!mesh) continue;

            const colorBuffer = this.getThinInstanceColorBuffer(mesh);
            if (!colorBuffer) continue;

            const offset = thinIndex * 4;
            colorBuffer[offset] = color.r;
            colorBuffer[offset + 1] = color.g;
            colorBuffer[offset + 2] = color.b;
            colorBuffer[offset + 3] = color.a;

            // CRITICAL: Must call thinInstanceSetBuffer to update
            mesh.thinInstanceSetBuffer("color", colorBuffer, 4, false);
        }
        this.thinOriginalColors.clear();

        // Restore mesh materials
        for (const [uniqueId, material] of this.meshOriginalMaterials) {
            const mesh = this.scene.getMeshByUniqueId(uniqueId) as Mesh;
            if (mesh) {
                mesh.material = material;
            }
        }
        this.meshOriginalMaterials.clear();
    }

    /**
     * Invalidate and rebuild highlights (called on mode switch).
     * Clears old highlights and re-emits selection state to trigger re-highlighting.
     */
    invalidateAndRebuild(): void {
        this.clearAll();
        // Re-emit current selection state to trigger re-highlighting
        // This is needed because mode switch changes mesh types (thin instances vs individual meshes)
    }

    /**
     * Dispose resources.
     */
    dispose(): void {
        this.clearAll();
        this.highlightMaterial.dispose();
    }

    private getThinInstanceColorBuffer(mesh: Mesh): Float32Array | null {
        const storage = (mesh as unknown as {
            _userThinInstanceBuffersStorage?: { data?: Record<string, Float32Array> };
        })._userThinInstanceBuffersStorage;

        const buffer = storage?.data?.color ?? null;
        return buffer instanceof Float32Array ? buffer : null;
    }
}
