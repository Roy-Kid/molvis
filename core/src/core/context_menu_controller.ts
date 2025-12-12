import { Pane } from "tweakpane";
import type { Molvis } from "@molvis/core";
import type { HitResult, MenuItem } from "../mode/types";

/**
 * Base class for mode-specific context menu controllers.
 * Each mode creates its own controller instance with mode-specific logic.
 * 
 * Event flow:
 * 1. Right-click event arrives at mode
 * 2. Mode calls contextMenuController.handleRightClick()
 * 3. Controller decides whether to show menu (via shouldShowMenu)
 * 4. If yes: builds menu items, shows menu, returns true (consumed)
 * 5. If no: returns false, mode handles the event
 */
export abstract class ContextMenuController {
    private container: HTMLDivElement | null = null;
    private pane: Pane | null = null;
    private isVisible: boolean = false;
    private onCloseCallback: (() => void) | null = null;

    // Bound event handlers for proper removal
    private boundHandleDocumentClick: (e: MouseEvent) => void;
    private boundHandleKeyDown: (e: KeyboardEvent) => void;

    constructor(
        protected app: Molvis,
        private containerId: string
    ) {
        this.boundHandleDocumentClick = this.handleDocumentClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Decide if menu should be shown for this event.
     * Override in subclasses to implement mode-specific logic.
     */
    protected abstract shouldShowMenu(hit: HitResult | null, isDragging: boolean): boolean;

    /**
     * Build menu items for the current context.
     * Override in subclasses to provide mode-specific menu items.
     */
    protected abstract buildMenuItems(hit: HitResult | null): MenuItem[];

    /**
     * Handle right-click event.
     * Returns true if event was consumed (menu shown), false otherwise.
     * @param ev Mouse event from Babylon.js (IMouseEvent)
     */
    public handleRightClick(ev: any, hit: HitResult | null, isDragging: boolean): boolean {
        // If menu is already open, close it
        if (this.isVisible) {
            this.hide();
            return true; // Consume the event
        }

        // Check if we should show menu
        if (!this.shouldShowMenu(hit, isDragging)) {
            return false; // Don't consume, let mode handle it
        }

        // Prevent default context menu
        ev.preventDefault();

        // Build and show menu
        const items = this.buildMenuItems(hit);
        if (items.length > 0) {
            this.show(ev.clientX, ev.clientY, items);
            return true; // Consumed
        }

        return false; // No items, don't consume
    }

    /**
     * Show the context menu at the specified position
     */
    public show(x: number, y: number, items: MenuItem[]): void {
        // Build menu if needed
        if (!this.container) {
            this.buildContainer();
        }

        if (!this.container || !this.pane) return;

        // Clear existing menu items
        this.clearMenuItems();

        // Add new menu items
        this.addMenuItems(items);

        // Position and show
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.display = 'block';
        (this.pane as any).hidden = false;
        this.isVisible = true;

        // Add document listeners to handle click outside and ESC
        setTimeout(() => {
            this.addDocumentListeners();
        }, 0);
    }

    /**
     * Hide the context menu
     */
    public hide(): void {
        this.removeDocumentListeners();

        if (this.container) {
            this.container.style.display = 'none';
        }
        if (this.pane) {
            (this.pane as any).hidden = true;
        }

        const wasVisible = this.isVisible;
        this.isVisible = false;

        // Notify callback if menu was visible and is now closed
        if (wasVisible && this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    /**
     * Check if menu is currently visible
     */
    public getIsVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Set callback to be called when menu is closed
     */
    public setOnCloseCallback(callback: () => void): void {
        this.onCloseCallback = callback;
    }

    /**
     * Dispose of the menu and clean up resources
     */
    public dispose(): void {
        this.removeDocumentListeners();
        if (this.pane) {
            this.pane.dispose();
            this.pane = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }

    // Private methods

    private buildContainer(): void {
        // Check if container already exists
        const existingContainer = document.getElementById(this.containerId) as HTMLDivElement;

        if (existingContainer) {
            this.container = existingContainer;
            if (this.pane) {
                this.pane.dispose();
            }
        } else {
            // Create new menu container
            this.container = document.createElement("div");
            this.container.id = this.containerId;
            this.container.className = "MolvisContextMenu";
            this.container.style.position = "absolute";
            this.container.style.pointerEvents = "auto";
            this.container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
            this.container.style.borderRadius = "8px";
            this.container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
            this.container.style.zIndex = "10000";
            this.container.style.display = "none";

            // Mount to UI overlay container
            this.app.uiContainer.appendChild(this.container);
        }

        // Create Tweakpane
        this.pane = new Pane({
            container: this.container,
            title: "Edit Tools",
            expanded: true
        });
        (this.pane as any).hidden = true;
    }

    private clearMenuItems(): void {
        if (!this.pane) return;

        const paneAny = this.pane as any;
        if (paneAny.children) {
            // Remove all children
            const children = [...paneAny.children];
            for (const child of children) {
                paneAny.remove(child);
            }
        }
    }

    private addMenuItems(items: MenuItem[]): void {
        if (!this.pane) return;

        for (const item of items) {
            this.addMenuItem(item, this.pane);
        }
    }

    private addMenuItem(item: MenuItem, parent: any): void {
        switch (item.type) {
            case "button":
                parent.addButton({ title: item.title || "Button" }).on("click", () => {
                    if (item.action) {
                        item.action();
                    }
                    this.hide();
                });
                break;

            case "separator":
                parent.addBlade({ view: 'separator' });
                break;

            case "folder":
                const folder = parent.addFolder({ title: item.title || "Folder" });
                if (item.items) {
                    for (const subItem of item.items) {
                        this.addMenuItem(subItem, folder);
                    }
                }
                break;

            case "binding":
                if (item.bindingConfig) {
                    const blade = parent.addBlade(item.bindingConfig);
                    if (blade && item.action) {
                        blade.on("change", item.action);
                    }
                }
                break;
        }
    }

    private handleDocumentClick(e: MouseEvent): void {
        if (!this.isVisible || !this.container) return;

        // Check if click is inside the menu
        const rect = this.container.getBoundingClientRect();
        const clickInside = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );

        if (!clickInside) {
            this.hide();
            e.stopPropagation();
            e.preventDefault();
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.isVisible) return;

        if (e.key === 'Escape') {
            this.hide();
            e.stopPropagation();
            e.preventDefault();
        }
    }

    private addDocumentListeners(): void {
        document.addEventListener('mousedown', this.boundHandleDocumentClick, true);
        document.addEventListener('keydown', this.boundHandleKeyDown, true);
    }

    private removeDocumentListeners(): void {
        document.removeEventListener('mousedown', this.boundHandleDocumentClick, true);
        document.removeEventListener('keydown', this.boundHandleKeyDown, true);
    }
}
