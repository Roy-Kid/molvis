import {
  Color3,
  Mesh,
  MeshBuilder,
  PointerInfo,
  StandardMaterial,
  Vector3,
  Scene,
  AbstractMesh
} from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { BaseMode, ModeType } from "./base";
import { pointOnScreenAlignedPlane } from "./utils";

/**
 * =============================
 * Refactored Edit Mode (TypeScript)
 * =============================
 * Goals:
 *  - Separate concerns: menu, previews, mesh staging, command execution.
 *  - Add explicit branch comments for readability.
 *  - Keep behavior compatible with the original code while being easier to maintain.
 *  - Implement minimal redo by re-executing stored commands.
 */

/* ----------------------------------
 * Types & Interfaces
 * ---------------------------------- */

enum EditCommandType {
  DrawAtom = "draw_atom",
  DrawBond = "draw_bond",
  DeleteAtom = "delete_atom",
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
 * MeshPool (staging + undo/redo + save)
 * ---------------------------------- */

class MeshPool {
  private stagedMeshes: Mesh[] = [];
  private persistentMeshes: Mesh[] = []; // Meshes that should NOT be disposed on clean
  private commandStack: CommandRecord[] = [];
  private undoStack: CommandRecord[] = [];

  addMesh(mesh: Mesh, persistent: boolean = false) {
    if (persistent) {
      this.persistentMeshes.push(mesh);
    } else {
      this.stagedMeshes.push(mesh);
    }
  }

  getStagedMeshes(): Mesh[] {
    return [...this.persistentMeshes, ...this.stagedMeshes];
  }

  hasStagedContent(): boolean {
    return this.stagedMeshes.length > 0 || this.persistentMeshes.length > 0;
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
      record.meshes.forEach((m) => {
        if (!this.persistentMeshes.includes(m)) {
          m.dispose();
        }
      });
      this.stagedMeshes = this.stagedMeshes.filter((m) => !record.meshes.includes(m));
    }
    return record || null;
  }

  redo(): CommandRecord | null {
    const record = this.undoStack.pop();
    if (record) {
      this.commandStack.push(record);
      // NOTE: real re-creation is handled by EditMode via re-execution.
    }
    return record || null;
  }

  saveToFrame(frame: FrameLike) {
    // Only save staged (new) meshes, not persistent ones (unless modified? assuming read-only for now)
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
    // Dispose only staged (temporary) meshes
    this.stagedMeshes.forEach((m) => m.dispose());
    this.stagedMeshes = [];
    // Clear persistent list but DO NOT dispose them
    this.persistentMeshes = [];
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
 * EditMode
 * ---------------------------------- */

class EditMode extends BaseMode {
  // State machine
  private startAtom: AbstractMesh | null = null;
  private hoverAtom: AbstractMesh | null = null;
  private pendingAtom = false; // click on blank = create atom

  private element_ = "C";
  private bondOrder_ = 1;

  private meshPool: MeshPool;
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
    this.meshPool = new MeshPool();

    // Initialize MeshPool with existing atoms in the scene
    this.world.scene.meshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        const md = mesh.metadata;
        // Check if it's an atom (either by metadata or name convention)
        if ((md && md.meshType === "atom") || mesh.name.includes("atom") || mesh.name.includes("sphere")) {
          this.meshPool.addMesh(mesh, true); // Add as persistent
        }
      }
    });

    // Initialize PreviewManager
    this.previews = new PreviewManager(app);
  }

  protected getCustomMenuBuilder(): ((pane: any) => void) | undefined {
    return (pane: any) => {
      const element = pane.addFolder({ title: "Atom" });
      (element.addBlade({
        view: "list",
        label: "Type",
        options: [
          { text: "Carbon", value: "C" },
          { text: "Nitrogen", value: "N" },
          { text: "Oxygen", value: "O" },
          { text: "Hydrogen", value: "H" },
          { text: "Sulfur", value: "S" },
          { text: "Phosphorus", value: "P" },
          { text: "Fluorine", value: "F" },
          { text: "Chlorine", value: "Cl" },
          { text: "Bromine", value: "Br" },
          { text: "Iodine", value: "I" },
        ],
        value: this.element,
      }) as any).on("change", (ev: any) => {
        this.element = ev.value;
      });

      const bond = pane.addFolder({ title: "Bond" });
      (bond.addBlade({
        view: "list",
        label: "Order",
        options: [
          { text: "Single", value: 1 },
          { text: "Double", value: 2 },
          { text: "Triple", value: 3 },
        ],
        value: this.bondOrder,
      }) as any).on("change", (ev: any) => {
        this.bondOrder = ev.value;
      });
    };
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
        this.meshPool.addMesh(mesh);
      }

      this.meshPool.addCommand(record);
    };

    try {
      const outcome = this.app.executor.execute(command, args);
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

    // [Branch] Left button → Hide context menu
    if (pointerInfo.event.button === 0) this.hideContextMenu();

    // Early exit for non-left clicks
    if (pointerInfo.event.button !== 0) return;

    // [Branch] Left click on atom mesh → start a bond from this atom
    const mesh = this.pick_mesh("atom");
    // Trust pick_mesh result (it handles metadata or name fallback)
    if (mesh) {
      this.startAtom = mesh;
      if (this.startAtom) {
        this.world.camera.detachControl(); // lock camera during drag-bond
        this.hoverAtom = null;
        return; // handled
      }
    }

    // [Branch] Left click on blank → mark potential standalone atom creation
    this.pendingAtom = true;
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

      const path = [
        new Vector3(this.startAtom.position.x, this.startAtom.position.y, this.startAtom.position.z),
        new Vector3(hover.position.x, hover.position.y, hover.position.z),
      ];
      this.previews.showBond(path);
    } else {
      // [Branch] Not over an atom: show preview atom + bond from start → preview point
      this.hoverAtom = null; // Clear hover state
      console.log("showAtom", xyz);
      this.previews.showAtom(xyz, 0.5, 0.5);
      const startPos = this.startAtom.position;
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
    const isRight = pointerInfo.event.button === 2;

    // -----------------------------
    // Left-button release cases
    // -----------------------------
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
        this.executeAndStage(EditCommandType.DrawBond, {
          start: this.startAtom.position.clone(),
          end: this.hoverAtom.position.clone(),
          options: { order: this.bondOrder },
        });
      } else {
        // [Branch] Released in empty space → create new atom + bond
        const atomName = makeId("atom");
        this.executeAndStage(EditCommandType.DrawAtom, {
          name: atomName,
          element: this.element,
          position: xyz,
          options: {},
        });
        // draw bond
        this.executeAndStage(EditCommandType.DrawBond, {
          start: this.startAtom.position.clone(),
          end: xyz,
          options: { order: this.bondOrder },
        });
      }

      // Cleanup drag state
      this.world.camera.attachControl(this.world.scene.getEngine().getRenderingCanvas(), false);
      this.previews.clear();
      this.startAtom = null;
      this.hoverAtom = null;
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

    // -----------------------------
    // Right-button cases
    // -----------------------------
    if (isRight && !this._is_dragging) {
      const hit = this.pick_mesh("atom");
      if (hit && hit.metadata?.meshType === "atom") {
        // [Branch] Right-click on atom → delete
        this.executeAndStage(EditCommandType.DeleteAtom, { atomId: hit.metadata.atomId ?? hit.uniqueId });
      } else if (!hit) {
        // [Branch] Right-click on blank → open menu
        pointerInfo.event.preventDefault();
        this.showContextMenu(pointerInfo.event.clientX, pointerInfo.event.clientY);
      }
    }
  }

  /* ------------------------------
   * Keyboard shortcuts
   * ------------------------------ */

  _on_press_ctrl_z(): void {
    const undone = this.meshPool.undo();
    if (undone) console.log("Undo:", undone.command);
  }

  _on_press_ctrl_y(): void {
    // naive redo: re-execute the command that was popped into redo stack (managed externally)
    const redone = this.meshPool.redo();
    if (!redone) return;
    // re-execute to recreate meshes
    this.executeAndStage(redone.command, redone.args);
  }

  _on_press_ctrl_s(): void {
    // this.saveToFrame();
  }

  public finish() {
    this.previews.clear();
    this.meshPool.clean();
    super.finish();
  }

  /* ------------------------------
   * Context menu controls
   * ------------------------------ */

  protected showContextMenu(x: number, y: number): void {
    this.contextMenu.show(x, y);
  }

  protected hideContextMenu(): void {
    this.contextMenu.hide();
  }
}

export { EditMode, MeshPool, PreviewManager, EditCommandType };
