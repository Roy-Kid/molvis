import { Pane } from "tweakpane";
import type { MolvisApp } from "../../app";

/**
 * Edit Mode Palette - Persistent configuration panel for edit mode
 * Shows atom type selector, bond order, and rendering parameters
 */
export class EditPalette {
    private container: HTMLElement | null = null;
    private pane: Pane | null = null;
    private app: MolvisApp;

    // Configuration state
    private config = {
        element: "C",
        bondOrder: 1,
        bondRadius: 0.05,  // Thinner bonds
        atomRadius: 0.3,
    };

    constructor(app: MolvisApp) {
        this.app = app;
    }

    public mount(parent: HTMLElement): void {
        // Create container
        this.container = document.createElement("div");
        this.container.className = "edit-palette";
        this.container.style.pointerEvents = "auto";
        parent.appendChild(this.container);

        // Create Tweakpane
        this.pane = new Pane({
            container: this.container,
            title: "Edit Tools",
            expanded: true,
        });

        this.buildPalette();
    }

    private buildPalette(): void {
        if (!this.pane) return;

        const paneAny = this.pane as any;

        // Atom element selector
        const atomFolder = paneAny.addFolder({ title: "Atom" });
        atomFolder.addBlade({
            view: "list",
            label: "Element",
            options: [
                { text: "Carbon (C)", value: "C" },
                { text: "Nitrogen (N)", value: "N" },
                { text: "Oxygen (O)", value: "O" },
                { text: "Hydrogen (H)", value: "H" },
                { text: "Sulfur (S)", value: "S" },
                { text: "Phosphorus (P)", value: "P" },
                { text: "Fluorine (F)", value: "F" },
                { text: "Chlorine (Cl)", value: "Cl" },
                { text: "Bromine (Br)", value: "Br" },
                { text: "Iodine (I)", value: "I" },
            ],
            value: this.config.element,
        }).on("change", (ev: any) => {
            this.config.element = ev.value;
            this.notifyModeUpdate();
        });

        atomFolder.addBinding(this.config, "atomRadius", {
            label: "Radius",
            min: 0.1,
            max: 1.0,
            step: 0.05,
        }).on("change", () => {
            this.notifyPaletteUpdate();
        });

        // Bond configuration
        const bondFolder = paneAny.addFolder({ title: "Bond" });
        bondFolder.addBlade({
            view: "list",
            label: "Order",
            options: [
                { text: "Single", value: 1 },
                { text: "Double", value: 2 },
                { text: "Triple", value: 3 },
            ],
            value: this.config.bondOrder,
        }).on("change", (ev: any) => {
            this.config.bondOrder = ev.value;
            this.notifyModeUpdate();
        });

        bondFolder.addBinding(this.config, "bondRadius", {
            label: "Radius",
            min: 0.01,
            max: 0.2,
            step: 0.01,
        }).on("change", () => {
            this.notifyPaletteUpdate();
        });
    }

    /**
     * Notify the current mode about configuration changes
     */
    private notifyModeUpdate(): void {
        const mode = this.app.mode?.currentMode;
        if (mode && (mode as any).element !== undefined) {
            (mode as any).element = this.config.element;
        }
        if (mode && (mode as any).bondOrder !== undefined) {
            (mode as any).bondOrder = this.config.bondOrder;
        }
    }

    /**
     * Notify the palette system about rendering parameter changes
     */
    private notifyPaletteUpdate(): void {
        // Update the global palette
        const palette = (this.app as any).palette;
        if (palette) {
            palette.defaultBondRadius = this.config.bondRadius;
            palette.defaultAtomRadius = this.config.atomRadius;
        }
    }

    public getConfig() {
        return { ...this.config };
    }

    public dispose(): void {
        if (this.pane) {
            this.pane.dispose();
            this.pane = null;
        }
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
            this.container = null;
        }
    }
}
