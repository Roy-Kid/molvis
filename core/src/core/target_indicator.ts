import { Vector3, Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";

/**
 * Visual indicator showing the current camera rotation target.
 * Displays as a small crosshair or sphere that fades after a few seconds.
 */
export class TargetIndicator {
    private mesh: Mesh | null = null;
    private scene: Scene;
    private fadeTimeout: NodeJS.Timeout | null = null;
    private isVisible: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Show the target indicator at a specific position
     */
    show(position: Vector3, isAtom: boolean = false): void {
        // Remove existing indicator
        this.hide();

        // Create crosshair indicator
        this.mesh = MeshBuilder.CreateSphere(
            "cameraTarget",
            { diameter: isAtom ? 0.3 : 0.2 },
            this.scene
        );

        this.mesh.position = position.clone();

        // Create material
        const material = new StandardMaterial("targetMaterial", this.scene);
        material.emissiveColor = isAtom ? Color3.Yellow() : Color3.White();
        material.disableLighting = true;
        material.alpha = 0.8;
        this.mesh.material = material;

        // Don't cast shadows or be pickable
        this.mesh.isPickable = false;
        this.mesh.receiveShadows = false;

        this.isVisible = true;

        // Auto-fade after 3 seconds
        this.fadeTimeout = setTimeout(() => {
            this.fadeOut();
        }, 3000);
    }

    /**
     * Fade out and hide the indicator
     */
    private fadeOut(): void {
        if (!this.mesh) return;

        const material = this.mesh.material as StandardMaterial;
        if (material) {
            // Simple fade by reducing alpha
            const fadeInterval = setInterval(() => {
                material.alpha -= 0.1;
                if (material.alpha <= 0) {
                    clearInterval(fadeInterval);
                    this.hide();
                }
            }, 50);
        } else {
            this.hide();
        }
    }

    /**
     * Immediately hide the indicator
     */
    hide(): void {
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }

        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }

        this.isVisible = false;
    }

    /**
     * Check if indicator is currently visible
     */
    get visible(): boolean {
        return this.isVisible;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.hide();
    }
}
