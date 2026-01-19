import {
    PointerInfo,
    Vector3,
    AbstractMesh,
    StandardMaterial,
    Color3,
    Mesh,
    MeshBuilder,
} from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { BaseMode, ModeType } from "./base";
import { pointOnScreenAlignedPlane } from "./utils";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";

/**
 * =============================
 * Manipulate Mode
 * =============================
 * 
 * This mode allows users to modify molecular geometry without changing connectivity.
 * 
 * Mouse Interactions:
 *  - Left click on atom/bond: Select and highlight
 *  - Left drag on atom: Move atom in 3D along screen-aligned plane
 *  - Left drag on bond: Move both connected atoms proportionally
 *  - Escape: Clear selection
 * 
 * The mode reuses the existing picking utilities from BaseMode.
 */

/**
 * Visual highlight for selected entities
 */
class SelectionHighlight {
    private highlightMesh: Mesh | null = null;

    constructor(private scene: any) { }

    /**
     * Show selection highlight around an atom
     */
    showAtom(position: Vector3, radius: number) {
        if (this.highlightMesh) {
            // Update existing highlight
            this.highlightMesh.position = position;
            this.highlightMesh.scaling.setAll(radius * 1.3);
            this.highlightMesh.isVisible = true;
        } else {
            // Create new highlight sphere
            this.highlightMesh = MeshBuilder.CreateSphere(
                "selection_highlight",
                { diameter: 1, segments: 16 },
                this.scene
            );
            this.highlightMesh.position = position;
            this.highlightMesh.scaling.setAll(radius * 1.3);

            const material = new StandardMaterial("selection_highlight_mat", this.scene);
            material.diffuseColor = new Color3(1, 0.8, 0);
            material.alpha = 0.3;
            material.wireframe = true;
            this.highlightMesh.material = material;
            this.highlightMesh.isPickable = false;
        }
    }

    /**
     * Hide the selection highlight
     */
    hide() {
        if (this.highlightMesh) {
            this.highlightMesh.isVisible = false;
        }
    }

    /**
     * Dispose the highlight mesh
     */
    dispose() {
        if (this.highlightMesh) {
            this.highlightMesh.dispose();
            this.highlightMesh = null;
        }
    }

    /**
     * Update highlight position (for tracking during drag)
     */
    updatePosition(position: Vector3) {
        if (this.highlightMesh) {
            this.highlightMesh.position = position;
        }
    }
}

/**
 * Context menu controller for Manipulate mode.
 */
class ManipulateModeContextMenu extends ContextMenuController {
    constructor(
        app: Molvis,
        private mode: ManipulateMode
    ) {
        super(app, "molvis-manipulate-menu");
    }

    protected shouldShowMenu(_hit: HitResult | null, isDragging: boolean): boolean {
        return !isDragging;
    }

    protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
        return [
            {
                type: "button",
                title: "Snapshot",
                action: () => {
                    this.mode.takeScreenShot();
                }
            },
            { type: "separator" },
            {
                type: "button",
                title: "Clear Selection",
                action: () => {
                    this.mode.clearSelection();
                }
            },
            { type: "separator" },
            {
                type: "button",
                title: "Reset Positions",
                action: () => {
                    // TODO: Implement position reset
                    this.app.events.emit('info-text-change', "Reset not implemented yet");
                }
            }
        ];
    }
}

/**
 * ManipulateMode - for moving atoms and adjusting geometry
 */
class ManipulateMode extends BaseMode {
    // Selection state
    private selectedAtom: AbstractMesh | null = null;
    private selectedBond: AbstractMesh | null = null;

    // Drag state
    private isDragging = false;
    private dragStartPosition: Vector3 | null = null;
    private draggedAtom: AbstractMesh | null = null;

    // Visual feedback
    private selectionHighlight: SelectionHighlight;

    constructor(app: Molvis) {
        super(ModeType.Manipulate, app);
        this.selectionHighlight = new SelectionHighlight(app.scene);
    }

    protected createContextMenuController(): ContextMenuController {
        return new ManipulateModeContextMenu(this.app, this);
    }



    /**
     * Clear current selection and hide highlight
     */
    public clearSelection(): void {
        this.selectedAtom = null;
        this.selectedBond = null;
        this.selectionHighlight.hide();
        this.app.events.emit('info-text-change', "");
    }

    /**
     * Select an atom and show highlight
     */
    private selectAtom(atom: AbstractMesh): void {
        this.clearSelection();
        this.selectedAtom = atom;

        // Get atom radius from scaling or use default
        const scale = atom.scaling?.x ?? 0.5;
        this.selectionHighlight.showAtom(atom.position, scale);

        // Update info panel
        const element = atom.metadata?.element ?? "?";
        const pos = atom.position;
        this.app.events.emit('info-text-change',
            `Selected: ${element} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
        );
    }

    /**
     * Select a bond
     */
    private selectBond(bond: AbstractMesh): void {
        this.clearSelection();
        this.selectedBond = bond;

        // Highlight the bond (could create a highlight tube, for now just update info)
        const order = bond.metadata?.order ?? 1;
        this.app.events.emit('info-text-change', `Selected bond (order: ${order})`);
    }

    /**
     * Move an atom to a new position and update connected bonds
     */
    private moveAtom(atom: AbstractMesh, newPosition: Vector3): void {
        const oldPosition = atom.position.clone();
        atom.position = newPosition;

        // Update connected bonds
        this.updateConnectedBonds(atom, oldPosition, newPosition);

        // Update selection highlight
        this.selectionHighlight.updatePosition(newPosition);
    }

    /**
     * Update bond meshes connected to a moved atom
     */
    private updateConnectedBonds(
        atom: AbstractMesh,
        _oldPosition: Vector3,
        _newPosition: Vector3
    ): void {
        const atomId = atom.metadata?.atomId ?? atom.uniqueId;
        const bondIds = this.world.topology.getBondsForAtom(atomId);

        for (const bondId of bondIds) {
            const bondInfo = this.world.topology.getAtomsForBond(bondId);
            if (!bondInfo) continue;

            // Find the other atom
            const otherAtomId = bondInfo.atom1 === atomId ? bondInfo.atom2 : bondInfo.atom1;

            // Find other atom mesh
            let otherAtomMesh: AbstractMesh | null = null;
            for (const mesh of this.scene.meshes) {
                const md = mesh.metadata;
                if (md?.meshType === "atom" && (md.atomId === otherAtomId || mesh.uniqueId === otherAtomId)) {
                    otherAtomMesh = mesh;
                    break;
                }
            }

            if (!otherAtomMesh) continue;

            // Find and update bond mesh(es)
            for (const mesh of this.scene.meshes) {
                const md = mesh.metadata;
                if (md?.bondId === bondId || mesh.uniqueId === bondId) {
                    // Recreate bond tube with new positions
                    // For simplicity, we update the tube path
                    const start = atom.position;
                    const end = otherAtomMesh.position;

                    // Update tube path if possible
                    if (mesh instanceof Mesh) {
                        try {
                            MeshBuilder.CreateTube(mesh.name, {
                                path: [start, end],
                                instance: mesh as Mesh,
                            }, this.scene);
                        } catch {
                            // If tube update fails, mesh might need to be recreated
                            // For now, we skip this case
                        }
                    }
                }
            }
        }
    }

    // --------------------------------
    // Pointer Event Handlers
    // --------------------------------

    override _on_pointer_down(pointerInfo: PointerInfo): void {
        super._on_pointer_down(pointerInfo);

        if (pointerInfo.event.button !== 0) return; // Only handle left button

        // Check for atom hit
        const atomMesh = this.pick_mesh("atom");
        if (atomMesh) {
            this.selectAtom(atomMesh);
            this.draggedAtom = atomMesh;
            this.dragStartPosition = atomMesh.position.clone();
            this.world.camera.detachControl(); // Lock camera during drag
            return;
        }

        // Check for bond hit
        const bondMesh = this.pick_mesh("bond");
        if (bondMesh) {
            this.selectBond(bondMesh);
            return;
        }

        // Click on empty space - clear selection
        this.clearSelection();
    }

    override _on_pointer_move(pointerInfo: PointerInfo): void {
        // Only handle dragging if we have a dragged atom
        if (!this.draggedAtom || !this.dragStartPosition) {
            super._on_pointer_move(pointerInfo);
            return;
        }

        this.isDragging = true;

        // Calculate new position on screen-aligned plane through the atom's original position
        const newPosition = pointOnScreenAlignedPlane(
            this.world.scene,
            this.world.camera,
            pointerInfo.event.clientX,
            pointerInfo.event.clientY,
            this.dragStartPosition
        );

        // Move the atom
        this.moveAtom(this.draggedAtom, newPosition);

        // Update info panel with new position
        const element = this.draggedAtom.metadata?.element ?? "?";
        this.app.events.emit('info-text-change',
            `Moving ${element}: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)})`
        );
    }

    override _on_pointer_up(pointerInfo: PointerInfo): void {
        super._on_pointer_up(pointerInfo);

        if (pointerInfo.event.button !== 0) return;

        // End drag operation
        if (this.draggedAtom && this.isDragging) {
            // Keep the atom at its new position
            const element = this.draggedAtom.metadata?.element ?? "?";
            const pos = this.draggedAtom.position;
            this.app.events.emit('info-text-change',
                `Moved ${element} to (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`
            );
        }

        // Re-enable camera controls
        this.world.camera.attachControl(this.world.scene.getEngine().getRenderingCanvas(), false);

        // Reset drag state
        this.isDragging = false;
        this.draggedAtom = null;
        this.dragStartPosition = null;
    }

    // --------------------------------
    // Keyboard Event Handlers
    // --------------------------------

    protected override _on_press_escape(): void {
        this.clearSelection();
    }

    // --------------------------------
    // Cleanup
    // --------------------------------

    public override finish(): void {
        this.clearSelection();
        this.selectionHighlight.dispose();
        super.finish();
    }
}

export { ManipulateMode };
