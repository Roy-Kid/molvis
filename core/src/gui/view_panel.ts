import type { MolvisApp } from "../core/app";
import type { GUIComponent } from "./types";

/**
 * ViewPanel - displays current camera view/projection
 * Position: top-left
 * Shows: "Front" or "Back" or "Persp" or "Ortho" based on current state
 */
export class ViewPanel implements GUIComponent {
    public element: HTMLElement;
    private app: MolvisApp;

    constructor(app: MolvisApp) {
        this.app = app;
        this.element = this.createPanel();
        this.updateDisplay();
    }

    private createPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.className = 'molvis-panel molvis-view-panel';
        return panel;
    }

    private updateDisplay(): void {
        const camera = this.app.world.camera;

        // Check projection mode first
        const isOrtho = camera.mode === 1; // ORTHOGRAPHIC_CAMERA = 1

        if (isOrtho) {
            this.element.textContent = 'Ortho';
            return;
        }

        // In perspective mode, check if we're in a specific view
        const alpha = camera.alpha;
        const beta = camera.beta;

        // Check for front view (alpha ≈ 0, beta ≈ π/2)
        if (Math.abs(alpha) < 0.1 && Math.abs(beta - Math.PI / 2) < 0.1) {
            this.element.textContent = 'Front';
            return;
        }

        // Check for back view (alpha ≈ π, beta ≈ π/2)
        if (Math.abs(alpha - Math.PI) < 0.1 && Math.abs(beta - Math.PI / 2) < 0.1) {
            this.element.textContent = 'Back';
            return;
        }

        // Default to Persp for perspective mode
        this.element.textContent = 'Persp';
    }

    public mount(container: HTMLElement): void {
        container.appendChild(this.element);

        // Update display when camera changes
        this.app.world.scene.onBeforeRenderObservable.add(() => {
            this.updateDisplay();
        });
    }

    public unmount(): void {
        this.element.remove();
    }

    public update(_data: any): void {
        this.updateDisplay();
    }

    public show(): void {
        this.element.style.display = 'block';
    }

    public hide(): void {
        this.element.style.display = 'none';
    }
}
