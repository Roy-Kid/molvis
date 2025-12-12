import { Color3, StandardMaterial } from "@babylonjs/core";
import type { MolvisApp as Molvis } from "../core/app";
import { command } from "./decorator";

export interface HighlightOptions {
    indices: number[];
    color?: string;
    scale?: number;
    opacity?: number;
}

/**
 * Highlight commands for emphasizing specific atoms
 */
class HighlightCommands {
    @command("highlight_atoms")
    static highlight_atoms(app: Molvis, options: HighlightOptions) {
        const { indices, color = "#FF0000", scale = 1.2, opacity = 1.0 } = options;
        const { world } = app;

        if (!indices || !Array.isArray(indices) || indices.length === 0) {
            throw new Error("highlight_atoms requires a non-empty indices array");
        }

        // Store highlighted atom indices for later clearing (using dynamic property)
        if (!(world as any).highlightedAtoms) {
            (world as any).highlightedAtoms = new Set<number>();
        }

        const highlightColor = Color3.FromHexString(color);
        const highlightedMeshes: any[] = [];

        // Iterate through all atom meshes and highlight specified indices
        for (const index of indices) {
            // Find atom mesh by index
            const atomMesh = world.scene.getMeshByName(`atom_${index}`);

            if (atomMesh && atomMesh.material) {
                const material = atomMesh.material as StandardMaterial;

                // Store original properties if not already highlighted
                if (!(world as any).highlightedAtoms.has(index)) {
                    (atomMesh as any)._originalColor = material.diffuseColor?.clone();
                    (atomMesh as any)._originalScale = atomMesh.scaling.clone();
                    (atomMesh as any)._originalAlpha = material.alpha;
                }

                // Apply highlight
                if (material.diffuseColor) {
                    material.diffuseColor = highlightColor.clone();
                }
                atomMesh.scaling.scaleInPlace(scale);
                material.alpha = opacity;

                (world as any).highlightedAtoms.add(index);
                highlightedMeshes.push(atomMesh);
            }
        }

        return {
            success: true,
            data: { indices, color, scale, opacity, count: highlightedMeshes.length },
            meshes: highlightedMeshes,
            entities: [],
        };
    }

    @command("clear_highlights")
    static clear_highlights(app: Molvis) {
        const { world } = app;

        if (!(world as any).highlightedAtoms || (world as any).highlightedAtoms.size === 0) {
            return { success: true, data: { count: 0 }, meshes: [], entities: [] };
        }

        const clearedMeshes: any[] = [];

        // Restore original properties for all highlighted atoms
        for (const index of (world as any).highlightedAtoms) {
            const atomMesh = world.scene.getMeshByName(`atom_${index}`);

            if (atomMesh && atomMesh.material) {
                const material = atomMesh.material as StandardMaterial;

                // Restore original color
                if ((atomMesh as any)._originalColor) {
                    material.diffuseColor = (atomMesh as any)._originalColor.clone();
                    delete (atomMesh as any)._originalColor;
                }

                // Restore original scale
                if ((atomMesh as any)._originalScale) {
                    atomMesh.scaling = (atomMesh as any)._originalScale.clone();
                    delete (atomMesh as any)._originalScale;
                }

                // Restore original alpha
                if ((atomMesh as any)._originalAlpha !== undefined) {
                    material.alpha = (atomMesh as any)._originalAlpha;
                    delete (atomMesh as any)._originalAlpha;
                }

                clearedMeshes.push(atomMesh);
            }
        }

        const count = (world as any).highlightedAtoms.size;
        (world as any).highlightedAtoms.clear();

        return {
            success: true,
            data: { count },
            meshes: clearedMeshes,
            entities: [],
        };
    }
}

export const highlight_atoms = HighlightCommands.highlight_atoms;
export const clear_highlights = HighlightCommands.clear_highlights;
