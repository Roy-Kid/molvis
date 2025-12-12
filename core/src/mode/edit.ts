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
import { pointOnScreenAlignedPlane, getPositionFromMatrix } from "./utils";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";
import { draw_atom, draw_bond, delete_atom, delete_bond, change_atom_element, cycle_bond_order } from "../commands";

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
 *  - Left click on atom: Change atom element to current element
 *  - Left click on bond: Cycle bond order (1 → 2 → 3 → 1)
 *  - Left drag from atom: Draw new atom + bond (or bond to existing atom)
 *  - Left drag from empty space: Rotate camera
 *  - Right click on atom: Delete atom and connected bonds
 *  - Right click on bond: Delete bond only
 *  - Right drag: Pan/translate camera
 */

/* ----------------------------------
 * Types & Interfaces
 * ---------------------------------- */

enum EditCommandType {
  DrawAtom = "draw_atom",
  DrawBond = "draw_bond",
  DeleteAtom = "delete_atom",
  DeleteBond = "delete_bond",
  ChangeAtomElement = "change_atom_element",
  CycleBondOrder = "cycle_bond_order",
}

interface CommandArgs {
  // Generic carrier for executor args; keep flexible for compatibility
  [k: string]: any;
}

interface CommandOutcome {
  meshes?: Mesh[];
  entities?: any[];
}

interface CommandRecord {
  command: EditCommandType | string;
  args: CommandArgs;
  meshes: Mesh[];
  entities: any[];
}

interface FrameLike {
  atoms: Array<{ name: string; element: string; xyz: { x: number; y: number; z: number } }>;
  bonds: Array<{
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    order: number;
  }>;
}

/* ----------------------------------
 * Utilities
 * ---------------------------------- */

function makeId(prefix = "atom"): string {
  return `${prefix}:${Math.random().toString(36).substring(2, 6)}`;
}

/* ----------------------------------
 * MeshStage (staging + undo/redo + save)
 * ---------------------------------- */

class MeshStage {
  private stagedMeshes: Mesh[] = [];
  private commandStack: CommandRecord[] = [];
  private undoStack: CommandRecord[] = [];

  addMesh(mesh: Mesh) {
    this.stagedMeshes.push(mesh);
  }

  getStagedMeshes(): Mesh[] {
    return [...this.stagedMeshes];
  }

  hasStagedContent(): boolean {
    return this.stagedMeshes.length > 0;
  }

  addCommand(record: CommandRecord) {
    this.commandStack.push(record);
    // Any successful command invalidates redo history normally
    this.undoStack = [];
  }

  undo(): CommandRecord | null {
    const record = this.commandStack.pop();
    if (record) {
      this.undoStack.push(record);
      // Dispose meshes & remove from staged
      record.meshes.forEach((m) => m.dispose());
      this.stagedMeshes = this.stagedMeshes.filter((m) => !record.meshes.includes(m));
    }
    return record || null;
  }

  redo(): CommandRecord | null {
    const record = this.undoStack.pop();
    if (record) {
      this.commandStack.push(record);
      // NOTE: Mesh re-creation is handled by EditMode via re-execution.
    }
    return record || null;
  }

  saveToFrame(frame: FrameLike) {
    // Save all staged meshes to frame
    for (const mesh of this.stagedMeshes) {
      const md = mesh.metadata || {};
      if (md.type === "atom") {
        frame.atoms.push({
          name: md.name,
          element: md.element,
          xyz: { x: md.x, y: md.y, z: md.z },
        });
      } else if (md.type === "bond") {
        frame.bonds.push({
          start: { x: md.x1, y: md.y1, z: md.z1 },
          end: { x: md.x2, y: md.y2, z: md.z2 },
          order: md.order ?? 1,
        });
      }
    }
  }

  clean() {
    // Dispose all staged meshes and clear undo/redo history
    this.stagedMeshes.forEach((m) => m.dispose());
    this.stagedMeshes = [];
    this.commandStack = [];
    this.undoStack = [];
  }
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

    // Atom element selector
    const atomFolder: MenuItem = {
      type: "folder",
      title: "Atom",
      items: [
        {
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
            console.log("[EditModeContextMenu] Element is now:", this.mode.element);
          }
        }
      ]
    };
    items.push(atomFolder);

    // Bond configuration
    const bondFolder: MenuItem = {
      type: "folder",
      title: "Bond",
      items: [
        {
          type: "binding",
          bindingConfig: {
            view: "list",
            label: "Order",
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
            console.log("[EditModeContextMenu] Bond order is now:", this.mode.bondOrder);
          }
        }
      ]
    };
    items.push(bondFolder);

    items.push({ type: "separator" });

    // Snapshot button
    items.push({
      type: "button",
      title: "Snapshot",
      action: () => {
        this.mode.takeScreenShot();
      }
    });

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

  private meshStage: MeshStage;
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
    this.bondOrder_ = v;
  }

  constructor(app: Molvis) {
    super(ModeType.Edit, app);
    this.meshStage = new MeshStage();
    this.previews = new PreviewManager(app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new EditModeContextMenu(this.app, this);
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
      const metadata = atomMesh.metadata;
      if (metadata?.matrices) {
        // Extract position from transformation matrix
        return getPositionFromMatrix(metadata.matrices as Float32Array, pickResult.thinInstanceIndex);
      }
    }

    // Regular atom mesh - use position directly
    return atomMesh.position.clone();
  }

  /* ------------------------------
   * Command execution + staging
   * ------------------------------ */

  private executeAndStage(command: EditCommandType | string, args: CommandArgs): CommandRecord {
    const record: CommandRecord = { command, args, meshes: [], entities: [] };

    const handleOutcome = (outcome: any) => {
      const { meshes, entities } = this.extractMeshesAndEntities(outcome);
      record.meshes = meshes;
      record.entities = entities;

      for (const mesh of meshes) {
        this.meshStage.addMesh(mesh);
      }

      this.meshStage.addCommand(record);
    };

    try {
      let outcome: any;

      // Direct function calls instead of app.execute
      switch (command) {
        case EditCommandType.DrawAtom:
          outcome = draw_atom(
            this.app,
            args.position as Vector3,
            {
              ...(args.options || {}),
              name: args.name as string,
              element: args.element as string,
            }
          );
          break;
        case EditCommandType.DrawBond:
          outcome = draw_bond(
            this.app,
            args.start as Vector3,
            args.end as Vector3,
            args.options || {}
          );
          break;
        case EditCommandType.DeleteAtom:
          outcome = delete_atom(this.app, args.atomId as number);
          break;
        case EditCommandType.DeleteBond:
          outcome = delete_bond(this.app, args.bondId as number);
          break;
        case EditCommandType.ChangeAtomElement:
          outcome = change_atom_element(this.app, args.atomId as number, args.element as string);
          break;
        case EditCommandType.CycleBondOrder:
          outcome = cycle_bond_order(this.app, args.bondMesh as Mesh);
          break;
        default:
          // Fallback to app.execute for unknown commands
          outcome = this.app.execute(command, args);
      }

      if (outcome && typeof (outcome as Promise<any>).then === "function") {
        (outcome as Promise<any>).then(handleOutcome).catch((err) => {
          throw err;
        });
      } else {
        handleOutcome(outcome);
      }
    } catch (err) {
      throw err;
    }

    return record;
  }

  private extractMeshesAndEntities(result: any): Required<CommandOutcome> {
    if (Array.isArray(result) && result.length === 2) {
      return { meshes: (result[0] as Mesh[]) ?? [], entities: result[1] ?? [] };
    }
    if (result && typeof result === "object") {
      const meshes = Array.isArray(result.meshes) ? (result.meshes as Mesh[]) : [];
      const entities = Array.isArray(result.entities) ? result.entities : [];
      return { meshes, entities };
    }
    return { meshes: [], entities: [] };
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

    // [Branch] Left click on atom (no drag) → change element if different
    if (isLeft && this.clickedAtom && !this._is_dragging && this.startAtom === this.clickedAtom) {
      const atomMesh = this.clickedAtom;
      const currentElement = atomMesh.metadata?.element;

      // Only change if the current element is different from the paint element
      if (currentElement && currentElement !== this.element) {
        this.executeAndStage(EditCommandType.ChangeAtomElement, {
          atomId: atomMesh.metadata?.atomId ?? atomMesh.uniqueId,
          element: this.element,
        });
      }

      // Cleanup
      this.world.camera.attachControl(this.world.scene.getEngine().getRenderingCanvas(), false);
      this.startAtom = null;
      this.clickedAtom = null;
      return;
    }

    // [Branch] Left click on bond (no drag) → cycle bond order
    if (isLeft && this.clickedBond && !this._is_dragging) {
      this.executeAndStage(EditCommandType.CycleBondOrder, {
        bondMesh: this.clickedBond as Mesh,
      });
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
        this.executeAndStage(EditCommandType.DrawBond, {
          start: startPos,
          end: endPos,
          options: { order: this.bondOrder },
        });
      } else if (this._is_dragging) {
        // [Branch] Released in empty space after drag → create new atom + bond
        const atomName = makeId("atom");
        this.executeAndStage(EditCommandType.DrawAtom, {
          name: atomName,
          element: this.element,
          position: xyz,
          options: {},
        });
        // draw bond
        const startPos = this.getAtomPosition(this.startAtom);
        this.executeAndStage(EditCommandType.DrawBond, {
          start: startPos,
          end: xyz,
          options: { order: this.bondOrder },
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
      this.executeAndStage(EditCommandType.DrawAtom, {
        name: atomName,
        element: this.element,
        position: Vector3.FromArray([xyz.x, xyz.y, xyz.z]),
        options: {},
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
    if (hit.type === "atom" && hit.metadata?.atomId !== undefined) {
      this.executeAndStage(EditCommandType.DeleteAtom, {
        atomId: hit.metadata.atomId ?? hit.mesh?.uniqueId
      });
      return;
    }

    // Right-click on bond → delete bond only
    if (hit.type === "bond" && hit.metadata?.bondId !== undefined) {
      this.executeAndStage(EditCommandType.DeleteBond, {
        bondId: hit.metadata.bondId ?? hit.mesh?.uniqueId
      });
      return;
    }
  }

  /* ------------------------------
   * Keyboard shortcuts
   * ------------------------------ */

  _on_press_ctrl_z(): void {
    const undone = this.meshStage.undo();
    if (undone) console.log("Undo:", undone.command);
  }

  _on_press_ctrl_y(): void {
    // Redo: re-execute the command that was popped from undo stack
    const redone = this.meshStage.redo();
    if (!redone) return;
    // Re-execute to recreate meshes
    this.executeAndStage(redone.command, redone.args);
  }

  _on_press_ctrl_s(): void {
    // this.saveToFrame();
  }

  public finish() {
    // Clear preview meshes but preserve staged edits in the scene
    this.previews.clear();
    // Note: We do NOT call meshStage.clean() here to preserve edits
    super.finish();
  }


}

export { EditMode, MeshStage, PreviewManager, EditCommandType };
