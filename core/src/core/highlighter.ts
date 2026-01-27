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

    // Shared highlight materials
    private selectionMaterial: StandardMaterial;
    private previewMaterial: StandardMaterial;

    // State
    private lastSelectionState: SelectionState = { atoms: new Set(), bonds: new Set() };
    private previewKeys: Set<string> = new Set();

    constructor(scene: Scene) {
        this.scene = scene;

        // Selection = Yellow
        this.selectionMaterial = new StandardMaterial("highlight_select", scene);
        this.selectionMaterial.diffuseColor = Color3.Yellow();
        this.selectionMaterial.emissiveColor = new Color3(0.5, 0.5, 0);

        // Preview = Cyan/Light Blue (distinct from selection)
        this.previewMaterial = new StandardMaterial("highlight_preview", scene);
        this.previewMaterial.diffuseColor = Color3.Teal();
        this.previewMaterial.emissiveColor = new Color3(0, 0.3, 0.3);
        this.previewMaterial.alpha = 0.8;
    }

    /**
     * Set the current selection state (redrawn immediately).
     */
    highlightSelection(state: SelectionState): void {
        this.lastSelectionState = state;
        this.render();
    }

    /**
     * Set the current preview (hover) keys.
     */
    highlightPreview(keys: string[]): void {
        this.previewKeys.clear();
        keys.forEach(k => this.previewKeys.add(k));
        this.render();
    }

    /**
     * Main render loop: Clears all, then applies Preview, then Selection (Selection overrides Preview).
     */
    private render(): void {
        this.clearAll();

        // 1. Apply Preview
        for (const key of this.previewKeys) {
            // If already selected, skip preview (Selection wins)
            if (this.lastSelectionState.atoms.has(key) || this.lastSelectionState.bonds.has(key)) {
                continue;
            }
            this.applyHighlight(key, this.previewMaterial, [0.0, 1.0, 1.0, 1.0]); // Cyan
        }

        // 2. Apply Selection
        for (const key of this.lastSelectionState.atoms) {
            this.applyHighlight(key, this.selectionMaterial, [1.0, 1.0, 0.0, 1.0]); // Yellow
        }
        for (const key of this.lastSelectionState.bonds) {
            this.applyHighlight(key, this.selectionMaterial, [1.0, 1.0, 0.0, 1.0]); // Yellow
        }
    }

    private applyHighlight(key: string, material: StandardMaterial, colorBufferVal: number[]): void {
        const ref = parseSelectionKey(key);
        if (!ref) return;

        const mesh = this.scene.getMeshByUniqueId(ref.meshId) as Mesh;
        if (!mesh) return;

        if (ref.subIndex !== undefined) {
            this.highlightThinInstance(mesh, ref.subIndex, colorBufferVal);
        } else {
            this.highlightMesh(mesh, material);
        }
    }

    /**
     * Highlight a thin instance.
     */
    private highlightThinInstance(mesh: Mesh, thinIndex: number, color: number[]): void {
        const colorBuffer = this.getThinInstanceColorBuffer(mesh);
        if (!colorBuffer) return;

        const offset = thinIndex * 4;
        const key = `${mesh.uniqueId}:${thinIndex}`;

        // Store original color (sparse) if not already stored
        if (!this.thinOriginalColors.has(key)) {
            this.thinOriginalColors.set(key, {
                r: colorBuffer[offset],
                g: colorBuffer[offset + 1],
                b: colorBuffer[offset + 2],
                a: colorBuffer[offset + 3]
            });
        }

        // Apply visual
        colorBuffer.set(color, offset);

        mesh.thinInstanceSetBuffer("color", colorBuffer, 4, false);
    }

    /**
     * Highlight a mesh.
     */
    private highlightMesh(mesh: Mesh, material: StandardMaterial): void {
        // Store original material if not already stored
        if (!this.meshOriginalMaterials.has(mesh.uniqueId)) {
            this.meshOriginalMaterials.set(mesh.uniqueId, mesh.material);
        }
        mesh.material = material;
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
     */
    invalidateAndRebuild(): void {
        this.clearAll();
        // Since we store state, we can just re-render
        // But invalidation usually implies scene geometry changed
        // So we might need to filter out keys that no longer exist?
        // For now, re-render catches up.
        this.render();
    }

    /**
     * Dispose resources.
     */
    dispose(): void {
        this.clearAll();
        this.selectionMaterial.dispose();
        this.previewMaterial.dispose();
    }

    private getThinInstanceColorBuffer(mesh: Mesh): Float32Array | null {
        const storage = (mesh as unknown as {
            _userThinInstanceBuffersStorage?: { data?: Record<string, Float32Array> };
        })._userThinInstanceBuffersStorage;

        // Key is 'instanceColor' in storage, but 'color' in public API
        const buffer = storage?.data?.instanceColor ?? null;
        return buffer instanceof Float32Array ? buffer : null;
    }
}
