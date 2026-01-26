import {
    PointerInfo,
    Vector3,
    AbstractMesh,
    StandardMaterial,
    Color3,
    Mesh,
    MeshBuilder,
} from "@babylonjs/core";
import { Block } from "molrs-wasm";
import type { Molvis } from "@molvis/core";
import { BaseMode, ModeType } from "./base";
import { pointOnScreenAlignedPlane } from "./utils";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";
import { DrawAtomCommand, DrawBondCommand, DrawFrameCommand } from "../commands/draw";
import { syncSceneToFrame } from "../core/scene_sync";

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
            material.alpha = 0.4;
            material.wireframe = false;
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
        const items: MenuItem[] = [];

        if (this.mode.hasUnsavedChanges()) {
            items.push(
                {
                    type: "button",
                    title: "Save Changes",
                    action: () => {
                        this.mode.saveChanges();
                    }
                },
                {
                    type: "button",
                    title: "Discard Changes",
                    action: () => {
                        this.mode.discardChanges();
                    }
                },
                { type: "separator" }
            );
        }

        items.push(
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
        );

        return items;
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

    // Frame conversion state
    private originalFrameData: {
        atomBlock: Block;
        bondBlock?: Block;
        atomMeshId: number;
        bondMeshId?: number;
    } | null = null;
    private convertedToMeshes = false;
    private materialCache: Map<string, StandardMaterial> = new Map();

    constructor(app: Molvis) {
        super(ModeType.Manipulate, app);
        this.selectionHighlight = new SelectionHighlight(app.scene);
    }

    public override start(): void {
        super.start();

        // Convert any frame-based entities found in SceneIndex
        // Topology is automatically managed by SceneIndex during conversion (unregister Frame -> register Mesh)
        this.convertFromSceneIndex().catch(console.error);
    }

    /**
     * Convert Frame entities from SceneIndex to editable meshes
     * Implementation of User Requirement: "Convert from SceneIndex, not Scene"
     */
    private async convertFromSceneIndex(): Promise<void> {
        const toDispose: number[] = [];
        const atomBlocks: Block[] = [];
        const bondBlocks: Block[] = [];

        // 1. Identify Frame entities
        // Iterate over SceneIndex entries
        for (const [uniqueId, entry] of this.world.sceneIndex.allEntries) {
            if (entry.kind === 'frame-atom') {
                atomBlocks.push(entry.atomBlock);
                toDispose.push(uniqueId);

                // Track for discard: (Simplified: assumes 1 frame for now, or last one wins)
                this.originalFrameData = {
                    atomBlock: entry.atomBlock,
                    bondBlock: undefined, // Will fill if bond found
                    atomMeshId: uniqueId,
                    bondMeshId: undefined
                };
            } else if (entry.kind === 'frame-bond') {
                bondBlocks.push(entry.bondBlock);
                toDispose.push(uniqueId);

                if (this.originalFrameData) {
                    this.originalFrameData.bondBlock = entry.bondBlock;
                    this.originalFrameData.bondMeshId = uniqueId;
                }
            }
        }

        if (atomBlocks.length === 0) {
            // Starting in Mesh Mode (hand-drawn only)
            this.originalFrameData = null;
            return;
        }

        // 2. Unregister ALL Frame entities/topology FIRST
        // This ensures clean slate and prevents "Delete after Add" topology bugs
        toDispose.forEach(uid => {
            const mesh = this.scene.getMeshByUniqueId(uid);
            this.world.sceneIndex.unregister(uid);
            if (mesh) mesh.dispose();
        });

        // 3. Convert Atoms (Populates Topology)
        for (const atomBlock of atomBlocks) {
            const count = atomBlock.nrows();
            const xCoords = atomBlock.col_f32('x')!;
            const yCoords = atomBlock.col_f32('y')!;
            const zCoords = atomBlock.col_f32('z')!;
            const elements = atomBlock.col_strings('element')!;

            for (let i = 0; i < count; i++) {
                const position = new Vector3(xCoords[i], yCoords[i], zCoords[i]);
                const element = elements[i];



                // Create command using explicit Semantic ID (index i)
                try {
                    const cmd = new DrawAtomCommand(
                        this.app,
                        position,
                        {
                            element,
                            atomId: i // Preserving Semantic ID 0..N
                        },
                        this.app.palette,
                        this.scene,
                        this.materialCache
                    );
                    cmd.do();

                    if (i === 55) {
                        // console.log(`[ManipulateMode] SUCCESS Atom 55 created. UID: ${mesh.uniqueId}`);
                    }
                } catch (err) {
                    console.error(`[ManipulateMode] FAIL creating Atom ${i}:`, err);
                }
            }
        }

        // 4. Convert Bonds (Populates Topology)
        for (const bondBlock of bondBlocks) {
            const count = bondBlock.nrows();
            const iAtoms = bondBlock.col_u32('i')!;
            const jAtoms = bondBlock.col_u32('j')!;
            const orders = bondBlock.col_u8('order');

            // We need coordinates for the bond endpoints.
            // Since we just created Atom meshes for these indices (0..N),
            // we can look them up by atomId?
            // Expensive to search?
            // SceneIndex has the newly registered atoms.
            // But we can also use the coordinates from the atomBlock corresponding to this bondBlock?
            // The bond entry in SceneIndex has `atomBlock` reference!

            // Let's find the corresponding atomBlock for coordinates.
            // We iterate bondBlocks. We need the atomBlock.
            // We can re-fetch it from the sceneIndex entry if we had the ID.
            // Or we check our `atomBlocks` array.
            // Typically 1 atomBlock per 1 bondBlock.

            // For now, assume 1-to-1 mapping or single frame. Use the first atomBlock?
            // Robust way: Use the coordinates of the NEWLY CREATED MESHES.
            // The `reconstruct` phase will fix topology. But we need to create the meshes first.
            // To create meshes we need positions.

            // Let's use `this.findAtomMeshByIndex` helper which searches by `atomId`.

            for (let b = 0; b < count; b++) {
                // Verify atoms exist in SceneIndex (created in step 3)
                const atomIMesh = this.findAtomMeshByIndex(iAtoms[b]);
                const atomJMesh = this.findAtomMeshByIndex(jAtoms[b]);

                if (!atomIMesh || !atomJMesh) {
                    console.warn(`[ManipulateMode] Skipping Bond ${b}: Atoms ${iAtoms[b]} or ${jAtoms[b]} missing.`);
                    continue;
                }

                const cmd = new DrawBondCommand(
                    this.app,
                    atomIMesh.position,
                    atomJMesh.position,
                    {
                        order: orders ? orders[b] : 1,
                        bondId: b, // Preserving Semantic ID
                        atomId1: iAtoms[b],
                        atomId2: jAtoms[b]
                    },
                    this.app.palette,
                    this.scene,
                    this.materialCache
                );
                cmd.do();
            }
        }

        this.convertedToMeshes = true;
    }

    private findAtomMeshByIndex(atomId: number): AbstractMesh | undefined {
        // Find mesh in SceneIndex with type='atom' and atomId=atomId
        // We can scan sceneIndex.allEntries now!
        for (const [uid, entry] of this.world.sceneIndex.allEntries) {
            if (entry.kind === 'atom' && entry.meta.atomId === atomId) {
                return this.scene.getMeshByUniqueId(uid) || undefined;
            }
        }
        return undefined;
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
        const meta = this.world.sceneIndex.getMeta(atom.uniqueId);
        const element = meta && meta.type === 'atom' ? meta.element : "?";
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
        const meta = this.world.sceneIndex.getMeta(bond.uniqueId);
        const order = meta && meta.type === 'bond' ? meta.order : 1;
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
    /**
     * Update bond meshes connected to a moved atom
     */
    private updateConnectedBonds(
        atom: AbstractMesh,
        _oldPosition: Vector3,
        _newPosition: Vector3
    ): void {
        const meta = this.world.sceneIndex.getMeta(atom.uniqueId);
        const atomId = meta && meta.type === 'atom' ? meta.atomId : -1;
        if (atomId === -1) {
            console.warn('[ManipulateMode] updateConnectedBonds: moved atom has invalid ID');
            return;
        }

        const bondIds = this.world.topology.getBondsForAtom(atomId);


        for (const bondId of bondIds) {
            const bondInfo = this.world.topology.getAtomsForBond(bondId);
            if (!bondInfo) {
                console.warn(`[ManipulateMode] No topology info for bond ${bondId}`);
                continue;
            }

            const otherAtomId = bondInfo.atom1 === atomId ? bondInfo.atom2 : bondInfo.atom1;
            const otherAtomMesh = this.scene.meshes.find(m => {
                const mMeta = this.world.sceneIndex.getMeta(m.uniqueId);
                return mMeta?.type === 'atom' && mMeta.atomId == otherAtomId; // Relaxed check
            });

            if (!otherAtomMesh) {
                console.warn(`[ManipulateMode] Could not find mesh for neighbor atom ${otherAtomId}`);

                // Deep diagnosis logic removed
                continue;
            }

            // Find existing bond mesh to update (dispose and recreate)
            const bondMesh = this.scene.meshes.find(m => {
                const bMeta = this.world.sceneIndex.getMeta(m.uniqueId);
                // Log failing comparisons if needed
                // console.log(`Checking mesh ${m.uniqueId}:`, bMeta);
                // Strict equality might fail if types differ?
                return bMeta?.type === 'bond' && bMeta.bondId == bondId; // Loose equality check safely
            });

            if (bondMesh) {

                const bondMeta = this.world.sceneIndex.getMeta(bondMesh.uniqueId);
                const order = bondMeta?.type === 'bond' ? bondMeta.order : 1;

                // Dispose old mesh
                this.world.sceneIndex.unregister(bondMesh.uniqueId);
                bondMesh.dispose();

                // Create new mesh
                const cmd = new DrawBondCommand(
                    this.app,
                    atom.position,
                    otherAtomMesh.position,
                    {
                        order,
                        bondId: bondId,
                        atomId1: atomId,
                        atomId2: otherAtomId
                    },
                    this.app.palette,
                    this.scene,
                    this.materialCache
                );
                const newMesh = cmd.do();

                // Register new mesh with correct ID
                this.world.sceneIndex.registerBond({
                    mesh: { uniqueId: newMesh.uniqueId },
                    meta: {
                        bondId: bondId,
                        atomId1: atomId,
                        atomId2: otherAtomId,
                        order,
                        start: { x: atom.position.x, y: atom.position.y, z: atom.position.z },
                        end: { x: otherAtomMesh.position.x, y: otherAtomMesh.position.y, z: otherAtomMesh.position.z }
                    }
                });
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
        const meta = this.world.sceneIndex.getMeta(this.draggedAtom.uniqueId);
        const element = meta && meta.type === 'atom' ? meta.element : "?";
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
            const meta = this.world.sceneIndex.getMeta(this.draggedAtom.uniqueId);
            const element = meta && meta.type === 'atom' ? meta.element : "?";
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
    // Frame Conversion Methods
    // --------------------------------

    /**
     * Check if there are unsaved changes
     */
    public hasUnsavedChanges(): boolean {
        return this.convertedToMeshes && this.originalFrameData !== null;
    }



    /**
     * Save changes: convert meshes back to frame
     */
    public async saveChanges(): Promise<void> {
        // Allow saving even if originalFrameData is missing (Mesh mode)
        if (!this.convertedToMeshes && !this.originalFrameData) {
            // Check if we have any atoms
            const hasAtoms = this.scene.meshes.some(m => {
                const meta = this.world.sceneIndex.getMeta(m.uniqueId);
                return meta?.type === 'atom';
            });
            if (!hasAtoms) return;
        }

        // Use syncSceneToFrame to update global system frame
        const frame = this.app.system.frame;
        if (!frame) {
            console.warn('[ManipulateMode] No system frame to save to');
            return;
        }

        syncSceneToFrame(this.scene, this.world.sceneIndex, frame);

        // Dispose individual meshes
        this.disposeAllAtomAndBondMeshes();

        // Redraw thin instances from the updated frame
        const { DrawFrameCommand } = await import('../commands/draw');
        // Note: DrawFrameCommand constructor expects frameData to create a new Frame internally
        // BUT we want to use our updated 'frame' directly.
        // We modify DrawFrameCommand usage to pass the frame
        const cmd = new DrawFrameCommand(this.app, {
            frame: frame
        });
        cmd.do();

        // Cleanup
        this.originalFrameData = null;
        this.convertedToMeshes = false;
        this.world.topology.clear();
        console.log('[ManipulateMode] Saved changes using syncSceneToFrame');
    }

    protected override _on_press_ctrl_s(): void {
        this.saveChanges().catch(console.error);
    }

    /**
     * Discard changes: restore original frame
     */
    public async discardChanges(): Promise<void> {
        if (!this.convertedToMeshes || !this.originalFrameData) {
            return;
        }

        // Dispose individual meshes
        this.disposeAllAtomAndBondMeshes();

        // Restore original frame
        const cmd = new DrawFrameCommand(this.app, {
            frameData: {
                blocks: {
                    atoms: {
                        x: this.originalFrameData.atomBlock.col_f32('x')!,
                        y: this.originalFrameData.atomBlock.col_f32('y')!,
                        z: this.originalFrameData.atomBlock.col_f32('z')!,
                        element: this.originalFrameData.atomBlock.col_strings('element') as string[]
                    },
                    bonds: this.originalFrameData.bondBlock ? {
                        i: this.originalFrameData.bondBlock.col_u32('i')!,
                        j: this.originalFrameData.bondBlock.col_u32('j')!,
                        order: this.originalFrameData.bondBlock.col_u8('order')
                    } : undefined
                },
                metadata: {}
            }
        });
        cmd.do();

        // Cleanup
        this.originalFrameData = null;
        this.convertedToMeshes = false;
        this.world.topology.clear();
        console.log('[ManipulateMode] Discarded changes and restored original frame');
    }





    /**
     * Helper: Dispose all atom and bond meshes
     */
    private disposeAllAtomAndBondMeshes(): void {
        const meshesToDispose: AbstractMesh[] = [];

        this.scene.meshes.forEach(mesh => {
            const meta = this.world.sceneIndex.getMeta(mesh.uniqueId);
            if (meta?.type === 'atom' || meta?.type === 'bond') {
                meshesToDispose.push(mesh);
            }
        });

        meshesToDispose.forEach(mesh => {
            this.world.sceneIndex.unregister(mesh.uniqueId);
            mesh.dispose();
        });

        this.world.topology.clear();
    }

    protected override _on_press_escape(): void {
        this.clearSelection();
    }

    // --------------------------------
    // Cleanup
    // --------------------------------

    public override finish(): void {
        // Do not auto-discard. Preserving meshes allows seamless mode switching.
        // User must explicitly Discard or Save if they want to revert or optimize.
        this.clearSelection();
        this.selectionHighlight.dispose();
        super.finish();
    }
}

export { ManipulateMode };
