import {
  Color3,
  Mesh,
  MeshBuilder,
  PointerInfo,
  StandardMaterial,
  Vector3,
  AbstractMesh
} from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { BaseMode, ModeType } from "./base";
import { pointOnScreenAlignedPlane } from "./utils";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";
import { CommonMenuItems } from "./menu_items";
import { Artist } from "./artist";
import { syncSceneToFrame } from "../core/scene_sync";
import { logger } from "../utils/logger";


/**
 * =============================
 * Refactored Edit Mode (TypeScript)
 * =============================
 * Goals:
 *  - Separate concerns: menu, previews, mesh staging, command execution.
 *  - Add explicit branch comments for readability.
 *  - Keep behavior compatible with the original code while being easier to maintain.
 *  - Implement minimal redo by re-executing stored commands.
 * 
 * Mouse Interactions (Draw Tool):
 *  - Left click on empty space: Create new atom with current element
 *  - Left drag from atom: Draw new atom + bond (or bond to existing atom)
 *  - Left drag from empty space: Rotate camera
 *  - Right click on atom: Delete atom and connected bonds
 *  - Right click on bond: Delete bond only
 *  - Right drag: Pan/translate camera
 */


/* ----------------------------------
 * Types & Interfaces
 * ---------------------------------- */

/* ----------------------------------
 * Utilities
 * ---------------------------------- */

function makeId(prefix = "atom"): string {
  return `${prefix}:${Math.random().toString(36).substring(2, 6)}`;
}

/* ----------------------------------
 * Preview Manager (isolates transient visuals)
 * ---------------------------------- */

class PreviewManager {
  private previewAtom: Mesh | null = null;
  private previewBond: Mesh | null = null;

  constructor(private app: Molvis) { }

  private get scene() {
    return this.app.scene;
  }

  /** Show or update the preview atom at a given position with optional opacity and diameter. */
  showAtom(position: Vector3, opacity: number = 1.0, diameter: number = 0.5) {
    if (!this.previewAtom) {
      // Create preview atom using Babylon.js directly
      this.previewAtom = MeshBuilder.CreateSphere("preview_atom", { diameter }, this.scene);

      const mat = new StandardMaterial("preview_atom_mat", this.scene);
      mat.diffuseColor = new Color3(0.7, 0.7, 0.7);
      mat.emissiveColor = new Color3(0.3, 0.3, 0.3);
      mat.alpha = opacity;
      mat.useAlphaFromDiffuseTexture = false;
      mat.needDepthPrePass = true;

      this.previewAtom.material = mat;
      this.previewAtom.isPickable = false;
      this.previewAtom.position = position;
    } else {
      // Update existing preview atom
      this.previewAtom.position = position;
      this.previewAtom.isVisible = true;

      // Update material opacity if needed
      const mat = this.previewAtom.material as StandardMaterial;
      if (mat) {
        mat.alpha = opacity;
      }
    }
  }

  /** Hide the preview atom. */
  hideAtom() {
    if (this.previewAtom) {
      this.previewAtom.isVisible = false;
    }
  }

  /** Show or update the preview bond along a path of two points. */
  showBond(path: Vector3[]) {
    if (this.previewBond) {
      MeshBuilder.CreateTube("preview_bond", { path, instance: this.previewBond }, this.scene);
    } else {
      this.previewBond = MeshBuilder.CreateTube(
        "preview_bond",
        { path, radius: 0.05, updatable: true },
        this.scene
      );
      const bmat = new StandardMaterial("preview_bond_mat", this.scene);
      bmat.diffuseColor = new Color3(0.8, 0.8, 0.8);
      this.previewBond.material = bmat;
    }
  }

  /** Clear previews. */
  clear() {
    if (this.previewAtom) {
      this.previewAtom.dispose();
      this.previewAtom = null;
    }
    if (this.previewBond) {
      this.previewBond.dispose();
      this.previewBond = null;
    }
  }
}

/* ----------------------------------
 * EditMode Context Menu Controller
 * ---------------------------------- */

/**
 * Context menu controller for Edit mode.
 * Only shows menu on empty space; atoms/bonds are handled by mode logic (deletion).
 */
class EditModeContextMenu extends ContextMenuController {
  constructor(
    app: Molvis,
    private mode: EditMode
  ) {
    super(app, "molvis-edit-menu");
  }

  protected shouldShowMenu(hit: HitResult | null, isDragging: boolean): boolean {
    // Only show menu on empty space, not on atoms/bonds
    return !isDragging && (!hit || hit.type === "empty");
  }

  protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
    const items: MenuItem[] = [];

    console.log("[EditModeContextMenu] Building menu, current element:", this.mode.element, "bondOrder:", this.mode.bondOrder);

    // Atom element selector (flat)
    items.push({
      type: "binding",
      bindingConfig: {
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
        value: this.mode.element,
      },
      action: (ev: any) => {
        console.log("[EditModeContextMenu] Element changed from", this.mode.element, "to", ev.value);
        this.mode.element = ev.value;
      }
    });

    items.push({ type: "separator" });

    // Bond configuration (flat)
    items.push({
      type: "binding",
      bindingConfig: {
        view: "list",
        label: "Bond Order",
        options: [
          { text: "Single", value: 1 },
          { text: "Double", value: 2 },
          { text: "Triple", value: 3 },
        ],
        value: this.mode.bondOrder,
      },
      action: (ev: any) => {
        console.log("[EditModeContextMenu] Bond order changed from", this.mode.bondOrder, "to", ev.value);
        this.mode.bondOrder = ev.value;
      }
    });

    items.push(CommonMenuItems.separator());

    // Snapshot (using common item)
    items.push(CommonMenuItems.snapshot(this.app));

    return items;
  }
}

/* ----------------------------------
 * EditMode
 * ---------------------------------- */

class EditMode extends BaseMode {
  // State machine for left-button operations
  private startAtom: AbstractMesh | null = null;
  private hoverAtom: AbstractMesh | null = null;
  private pendingAtom = false; // click on blank = create atom
  private clickedAtom: AbstractMesh | null = null; // for element change on click
  private clickedBond: AbstractMesh | null = null; // for bond order cycling on click

  private element_ = "C";
  private bondOrder_ = 1;

  public artist: Artist;
  private previews: PreviewManager;

  get element(): string {
    return this.element_;
  }
  set element(v: string) {
    this.element_ = v;
  }

  get bondOrder(): number {
    return this.bondOrder_;
  }
  set bondOrder(v: number) {
    console.log('[EditMode] bondOrder setter called, changing from', this.bondOrder_, 'to', v);
    this.bondOrder_ = v;
  }

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
    this.artist = new Artist({
      palette: app.palette,
      scene: app.world.scene,
      app: app,
    });
    this.previews = new PreviewManager(app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new EditModeContextMenu(this.app, this);
  }

  /**
   * Start EditMode - invalidate highlights for mode switch
   */
  override start(): void {
    super.start();

    // Invalidate highlights for mode switch (Edit uses individual meshes)
    this.app.world.highlighter.invalidateAndRebuild();
  }

  /* ------------------------------
   * Helper methods
   * ------------------------------ */

  /**
   * Get the actual position of an atom mesh.
   * Handles both regular atom meshes and thin instance atoms from draw_frame.
   */
    private getAtomPosition(atomMesh: AbstractMesh): Vector3 {
    const scene = this.world.scene;
    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh: AbstractMesh) => mesh === atomMesh,
      false,
      this.world.camera
    );

    // Check if this is a thin instance atom (from draw_frame)
    if (pickResult.hit && pickResult.thinInstanceIndex !== undefined && pickResult.thinInstanceIndex !== -1) {
      const meta = this.world.sceneIndex.getMeta(atomMesh.uniqueId, pickResult.thinInstanceIndex);
      if (meta && meta.type === 'atom') {
        return new Vector3(meta.position.x, meta.position.y, meta.position.z);
      }
    }

    // Regular atom mesh - use position directly
    return atomMesh.position.clone();
  }


  /* ------------------------------
   * Pointer events (with branch comments)
   * ------------------------------ */

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);

    const isLeft = pointerInfo.event.button === 0;

    // Reset click tracking
    this.clickedAtom = null;
    this.clickedBond = null;

    if (isLeft) {
      // [Branch] Left click on atom mesh → could be: start bond drag OR change element
      const atomMesh = this.pick_mesh("atom");
      if (atomMesh) {
        this.startAtom = atomMesh;
        this.clickedAtom = atomMesh; // Track for potential element change on click-release
        this.world.camera.detachControl(); // lock camera during drag-bond
        this.hoverAtom = null;
        return;
      }

      // [Branch] Left click on bond → track for potential order cycling
      const bondMesh = this.pick_mesh("bond");
      if (bondMesh) {
        this.clickedBond = bondMesh;
        return;
      }

      // [Branch] Left click on blank → mark potential standalone atom creation
      this.pendingAtom = true;
    }

  }

  override _on_pointer_move(pointerInfo: PointerInfo) {
    super._on_pointer_move(pointerInfo);

    // Only react if we are dragging from an atom (drawing a bond)
    // Check if left button is pressed (buttons === 1 means left button is down during move)
    if (!this.startAtom) return;

    // Calculate current cursor position in 3D space
    // Use startAtom position as anchor to ensure the plane passes through the atom
    const xyz = pointOnScreenAlignedPlane(
      this.world.scene,
      this.world.camera,
      pointerInfo.event.clientX,
      pointerInfo.event.clientY,
      this.startAtom.position
    );

    // Attempt to magnet to another atom under cursor
    const hit = this.pick_mesh("atom");
    let hover: AbstractMesh | null = null;

    // [Branch] Cursor over another atom & not the start atom → magnetic snapping
    // Trust pick_mesh result directly - if we hit an atom, we snap to it
    if (hit && hit !== this.startAtom) {
      hover = hit;
    }

    if (hover) {
      // [Branch] Snapped to existing atom: hide preview atom, show bond preview from start → hover
      this.hoverAtom = hover; // Update state for _on_pointer_up
      this.previews.hideAtom();

      const startPos = this.getAtomPosition(this.startAtom);
      const hoverPos = this.getAtomPosition(hover);
      const path = [
        new Vector3(startPos.x, startPos.y, startPos.z),
        new Vector3(hoverPos.x, hoverPos.y, hoverPos.z),
      ];
      this.previews.showBond(path);
    } else {
      // [Branch] Not over an atom: show preview atom + bond from start → preview point
      this.hoverAtom = null; // Clear hover state
      console.log("showAtom", xyz);
      this.previews.showAtom(xyz, 0.5, 0.5);
      const startPos = this.getAtomPosition(this.startAtom);
      const path = [
        new Vector3(startPos.x, startPos.y, startPos.z),
        xyz,
      ];
      this.previews.showBond(path);
    }
  }

  override _on_pointer_up(pointerInfo: PointerInfo) {
    super._on_pointer_up(pointerInfo);

    const isLeft = pointerInfo.event.button === 0;

    // -----------------------------
    // Left-button release cases
    // -----------------------------

    // [Branch] Left click on atom (no drag) - removed change element feature
    // Just cleanup and return
    if (isLeft && this.clickedAtom && !this._is_dragging && this.startAtom === this.clickedAtom) {
      // Cleanup
      this.world.camera.attachControl(this.world.scene.getEngine().getRenderingCanvas(), false);
      this.startAtom = null;
      this.clickedAtom = null;
      return;
    }

    // [Branch] Left click on bond (no drag) - removed cycle bond order feature
    // Just cleanup and return
    if (isLeft && this.clickedBond && !this._is_dragging) {
      this.clickedBond = null;
      return;
    }

    if (isLeft && this.startAtom) {
      // [Branch] Releasing after drag from an atom
      const xyz = pointOnScreenAlignedPlane(
        this.world.scene,
        this.world.camera,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY
      );
      if (this.hoverAtom) {
        // [Branch] Snapped to existing atom → create bond only
        const startPos = this.getAtomPosition(this.startAtom);
        const endPos = this.getAtomPosition(this.hoverAtom);
        this.artist.drawBond(startPos, endPos, {
          order: this.bondOrder,
        });
      } else if (this._is_dragging) {
        // [Branch] Released in empty space after drag → create new atom + bond
        const atomName = makeId("atom");
        this.artist.drawAtom(xyz, {
          element: this.element,
          name: atomName,
        });
        // draw bond
        const startPos = this.getAtomPosition(this.startAtom);
        this.artist.drawBond(startPos, xyz, {
          order: this.bondOrder,
        });
      }

      // Cleanup drag state
      this.world.camera.attachControl(this.world.scene.getEngine().getRenderingCanvas(), false);
      this.previews.clear();
      this.startAtom = null;
      this.hoverAtom = null;
      this.clickedAtom = null;
      return;
    }

    if (isLeft && this.pendingAtom && !this._is_dragging) {
      // [Branch] Click on blank (no drag): create isolated atom
      const xyz = pointOnScreenAlignedPlane(
        this.world.scene,
        this.world.camera,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY
      );
      const atomName = makeId("atom");
      this.artist.drawAtom(Vector3.FromArray([xyz.x, xyz.y, xyz.z]), {
        element: this.element,
        name: atomName,
      });
      this.pendingAtom = false;
      return;
    }

    if (isLeft && this.pendingAtom) {
      // [Branch] Left up but had dragged → cancel pending creation
      // user changes view
      this.pendingAtom = false;
      return;
    }

  }

  /**
   * Handle right-click when context menu doesn't consume the event.
   * In Edit mode, this handles atom and bond deletion.
   */
  protected override onRightClickNotConsumed(_pointerInfo: PointerInfo, hit: HitResult | null): void {
    if (!hit) return;

    // Right-click on atom → delete atom and connected bonds
    if (hit.type === "atom" && hit.mesh) {
      this.artist.deleteAtom(hit.mesh as Mesh);
      return;
    }

    // Right-click on bond → delete bond only
    if (hit.type === "bond" && hit.mesh) {
      this.artist.deleteBond(hit.mesh as Mesh);
      return;
    }
  }

  /* ------------------------------
   * Keyboard shortcuts
   * ------------------------------ */

  _on_press_ctrl_z(): void {
    this.artist.undo();
  }

  _on_press_ctrl_y(): void {
    this.artist.redo();
  }

  _on_press_ctrl_s(): void {
    this.saveToFrame();
  }

  /**
   * Save current scene state to Frame.
   * This makes Frame the single source of truth by synchronizing all scene data.
   */
  private saveToFrame(): void {
    const frame = this.app.system.frame;

    if (!frame) {
      logger.warn('[EditMode] No Frame loaded, cannot save');
      return;
    }

    logger.info('[EditMode] Saving scene to Frame...');
    syncSceneToFrame(this.world.scene, this.world.sceneIndex, frame);
    logger.info('[EditMode] Successfully saved to Frame');
  }


  public finish() {
    // Clear preview meshes
    // Note: Artist is NOT disposed to preserve material cache across mode switches
    this.previews.clear();
    super.finish();
  }


}

export { EditMode, PreviewManager };
