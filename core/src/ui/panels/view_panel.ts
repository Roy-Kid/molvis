import { MolvisApp } from "../../core/app";
import type { GUIComponent } from "../types";

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
        panel.style.cursor = 'pointer';
        panel.title = 'Click to potential view options';

        panel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMenu(e.clientX, e.clientY);
        });

        return panel;
    }

    private showMenu(x: number, y: number): void {
        const menu = document.createElement('molvis-context-menu') as any; // Cast to any to avoid type check issues if class not exported fully
        // But we should use the class if available.
        // It's a web component.

        const items = [
            {
                type: 'button',
                title: 'Perspective',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.mode = 0; // PERSPECTIVE_CAMERA
                    // Clear ortho bounds to avoid interference if we switch back and forth differently
                    camera.orthoLeft = null;
                    camera.orthoRight = null;
                    camera.orthoTop = null;
                    camera.orthoBottom = null;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Orthographic',
                action: () => {
                    const camera = this.app.world.camera;
                    // Calculate current view size at target to match perspective view
                    const dist = camera.radius;
                    const fov = camera.fov;
                    const aspect = this.app.world.scene.getEngine().getAspectRatio(camera);

                    // Height at target distance
                    const height = 2 * dist * Math.tan(fov / 2);
                    const width = height * aspect;

                    camera.orthoTop = height / 2;
                    camera.orthoBottom = -height / 2;
                    camera.orthoLeft = -width / 2;
                    camera.orthoRight = width / 2;

                    camera.mode = 1; // ORTHOGRAPHIC_CAMERA
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Front',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.alpha = 0;
                    camera.beta = Math.PI / 2;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Back',
                action: () => {
                    const camera = this.app.world.camera;
                    // Existing check: "if (Math.abs(alpha - Math.PI) < 0.1 ... 'Back'"
                    camera.alpha = Math.PI;
                    camera.beta = Math.PI / 2;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Left',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.alpha = -Math.PI / 2;
                    camera.beta = Math.PI / 2;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Right',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.alpha = Math.PI / 2;
                    camera.beta = Math.PI / 2;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Top',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.beta = 0;
                    this.updateDisplay();
                }
            },
            {
                type: 'button',
                title: 'Bottom',
                action: () => {
                    const camera = this.app.world.camera;
                    camera.beta = Math.PI;
                    this.updateDisplay();
                }
            },
            { type: 'separator' },
            {
                type: 'button',
                title: 'Reset Camera',
                action: () => {
                    // Reset to default view
                    const camera = this.app.world.camera;
                    camera.mode = 0; // Ensure Perspective
                    camera.orthoLeft = null;
                    camera.orthoRight = null;
                    camera.orthoTop = null;
                    camera.orthoBottom = null;

                    camera.alpha = Math.PI / 2;
                    camera.beta = Math.PI / 2;
                    camera.radius = 20;
                    camera.target.set(0, 0, 0);
                    this.updateDisplay();
                }
            }
        ];


        // Append to overlay
        const overlay = document.getElementById('molvis-ui-overlay');
        if (overlay) {
            overlay.appendChild(menu);
            menu.show(x, y, items);
        }
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
