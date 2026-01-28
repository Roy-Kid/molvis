import { MolvisElement } from '../base';
import type { MenuItem } from '../../mode/types';
import { createControl } from '../builder';
import { logger } from "../../utils/logger";

/**
 * MolvisContextMenu - Main context menu web component
 * Displays a context menu at specified screen coordinates with menu items.
 */
export class MolvisContextMenu extends MolvisElement {
    private container: HTMLDivElement | null = null;

    constructor() {
        super();
    }

    /**
     * Show the context menu at the specified position with menu items
     */
    public show(x: number, y: number, items: MenuItem[]): void {
        this.render();

        if (!this.container) {
            logger.error('[MolvisContextMenu] Container is null after render!');
            return;
        }

        // Clear previous items
        // Clear previous items
        this.container.innerHTML = '';

        // Render menu items
        items.forEach((item, _index) => {
            const control = createControl(item);
            if (control) {
                this.container!.appendChild(control);
            }
        });

        // Position menu
        this.style.left = `${x}px`;
        this.style.top = `${y}px`;
        this.style.display = 'block';

        // Adjust position if menu goes off-screen
        requestAnimationFrame(() => {
            this.adjustPosition(x, y);
        });
    }

    /**
     * Hide the context menu
     */
    public hide(): void {
        this.style.display = 'none';
    }

    /**
     * Adjust menu position to stay within viewport bounds
     */
    private adjustPosition(x: number, y: number): void {
        const rect = this.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = x;
        let adjustedY = y;

        // Check right edge
        if (x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 10;
        }

        // Check bottom edge
        if (y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 10;
        }

        // Ensure menu doesn't go off left or top edge
        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);

        this.style.left = `${adjustedX}px`;
        this.style.top = `${adjustedY}px`;
    }

    protected override render(): void {
        // If container exists, just return - show() handles content updates
        if (this.container) return;

        this.injectSharedStyles();

        const style = document.createElement('style');
        style.textContent = `
            :host {
                position: fixed;
                display: none;
                z-index: 10000;
                min-width: 180px;
                max-width: 300px;
                background: var(--bg-color);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                padding: 4px 0;
                pointer-events: auto; /* Enable clicks */
            }
        `;
        this.root.appendChild(style);

        this.container = document.createElement('div');
        this.container.className = 'menu-container';
        this.root.appendChild(this.container);
    }
}
