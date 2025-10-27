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
import { Pane } from "tweakpane";
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
 * Menu (Tweakpane)
 * ---------------------------------- */

class EditModeMenu {
  private container: HTMLDivElement;
  private pane: Pane;

  constructor(private em: EditMode) {
    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    document.body.appendChild(this.container);
    this.pane = new Pane({ container: this.container, title: "Edit Mode" });
    this.pane.hidden = true;
    this.build();
  }

  private build() {
    this.pane.children.forEach((c) => this.pane.remove(c));

    const element = this.pane.addFolder({ title: "Atom" });
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
      value: this.em.element,
    }) as any).on("change", (ev: any) => {
      this.em.element = ev.value;
    });

    const bond = this.pane.addFolder({ title: "Bond" });
    (bond.addBlade({
      view: "list",
      label: "Order",
      options: [
        { text: "Single", value: 1 },
        { text: "Double", value: 2 },
        { text: "Triple", value: 3 },
      ],
      value: this.em.bondOrder,
    }) as any).on("change", (ev: any) => {
      this.em.bondOrder = ev.value;
    });
  }

  public show(x: number, y: number) {
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.pane.hidden = false;
  }

  public hide() {
    this.pane.hidden = true;
  }
}

/* ----------------------------------
 * MeshPool (staging + undo/redo + save)
 * ---------------------------------- */

class MeshPool {
  private stagedMeshes: Mesh[] = [];
  private commandStack: CommandRecord[] = [];
  private undoStack: CommandRecord[] = [];

  addMesh(mesh: Mesh) {
    this.stagedMeshes.push(mesh);
  }

  getStagedMeshes(): Mesh[] {
    return this.stagedMeshes;
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
      // NOTE: real re-creation is handled by EditMode via re-execution.
    }
    return record || null;
  }

  saveToFrame(frame: FrameLike) {
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
  private highlightedMesh: Mesh | null = null;

  constructor(private scene: Scene) {}

  /** Highlight a mesh (outline). */
  setHighlight(mesh: Mesh | null) {
    // Clear existing highlight first
    if (this.highlightedMesh) this.highlightedMesh.renderOutline = false;
    this.highlightedMesh = null;

    if (mesh) {
      mesh.renderOutline = true;
      this.highlightedMesh = mesh;
    }
  }

  /** Show or update the preview atom at a given position. */
  showAtom(position: Vector3) {
    if (!this.previewAtom) {
      this.previewAtom = MeshBuilder.CreateSphere("preview_atom", { diameter: 0.5 }, this.scene);
      const mat = new StandardMaterial("preview_atom_mat", this.scene);
      mat.diffuseColor = new Color3(0.5, 0.5, 0.5);
      this.previewAtom.material = mat;
    }
    this.previewAtom.position.copyFrom(position);
  }

  /** Show or update the preview bond along a path of two points. */
  showBond(path: Vector3[]) {
    if (this.previewBond) {
      MeshBuilder.CreateTube("preview_bond", { path, instance: this.previewBond });
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

  /** Clear previews and highlight. */
  clear() {
    if (this.previewAtom) {
      this.previewAtom.dispose();
      this.previewAtom = null;
    }
    if (this.previewBond) {
      this.previewBond.dispose();
      this.previewBond = null;
    }
    if (this.highlightedMesh) {
      this.highlightedMesh.renderOutline = false;
      this.highlightedMesh = null;
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

  private menu?: EditModeMenu;
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
    this.previews = new PreviewManager(this.world.scene);
    if (typeof document !== "undefined") {
      this.menu = new EditModeMenu(this);
    }
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
      // eslint-disable-next-line no-console
      console.log(`Executed & staged: ${command}`, args);
    };

    try {
      const outcome = this.app.executor.execute(command, args);
      console.log("Outcome:", outcome);
      if (outcome && typeof (outcome as Promise<any>).then === "function") {
        (outcome as Promise<any>).then(handleOutcome).catch((err) => {
          console.error(`Command failed: ${command}`, err);
        });
      } else {
        handleOutcome(outcome);
      }
    } catch (err) {
      console.error(`Command threw: ${command}`, err);
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

  // private createMetadata(command: EditCommandType | string, args: CommandArgs): any {
  //   if (command === EditCommandType.DrawAtom || command === "draw_atom") {
  //     const x = args.position.x;
  //     const y = args.position.y;
  //     const z = args.position.z;
  //     return { type: "atom", command, args, name: args.name, element: args.element, x, y, z };
  //   }
  //   if (command === EditCommandType.DrawBond || command === "draw_bond") {
  //     const x1 = args.start.x;
  //     const y1 = args.start.y;
  //     const z1 = args.start.z;
  //     const x2 = args.end.x;
  //     const y2 = args.end.y;
  //     const z2 = args.end.z;
  //     return {
  //       type: "bond",
  //       command,
  //       args,
  //       x1,
  //       y1,
  //       z1,
  //       x2,
  //       y2,
  //       z2,
  //       order: args.options?.order || 1,
  //     };
  //   }
  //   if (command === EditCommandType.DeleteAtom || command === "delete_atom") {
  //     return { type: "deleted_atom", command, args, atomName: args.atom?.name || args.atomName };
  //   }
  //   return { type: "unknown", command, args };
  // }

  /* ------------------------------
   * Helpers
   * ------------------------------ */

  // private findAtomByName(name: string): Atom | null {
  //   // 1) search in current frame
  //   const a = this.world.currentFrame.atoms.find((it: any) => it.name === name);
  //   if (a) return a;

  //   // 2) search in staged meshes metadata
  //   const staged = this.meshPool.getStagedMeshes();
  //   const mesh = staged.find((m: any) => m.metadata?.name === name);
  //   if (mesh && mesh.metadata) {
  //     const { x, y, z } = mesh.metadata as any;
  //     return {
  //       name: mesh.metadata.name,
  //       xyz: { x, y, z },
  //       get: (k: string) => mesh.metadata[k],
  //     } as any;
  //   }
  //   return null;
  // }

  private highlightAtom(atom: Atom | null) {
    // Remove then set
    this.previews.setHighlight(null);
    if (!atom) return;

    // find Babylon mesh by naming convention
    let mesh = this.world.scene.getMeshByName(`atom:${atom.name}`) as Mesh | null;
    if (!mesh) {
      mesh = this.meshPool.getStagedMeshes().find((m) => m.metadata?.name === atom.name) || null;
    }
    if (mesh) this.previews.setHighlight(mesh);
  }

  private saveToFrame() {
    if (!this.meshPool.hasStagedContent()) return;
    this.meshPool.saveToFrame(this.world.currentFrame as unknown as FrameLike);
    this.meshPool.clean();
    console.log("Changes saved to current frame");
  }

  /* ------------------------------
   * Pointer events (with branch comments)
   * ------------------------------ */

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);

    // [Branch] Left button → Hide context menu
    if (pointerInfo.event.button === 0) this.menu?.hide();

    // Early exit for non-left clicks
    if (pointerInfo.event.button !== 0) return;

    // [Branch] Left click on atom mesh → start a bond from this atom
    const mesh = this.pick_mesh("atom");
    console.log("Picked mesh on pointer down:", mesh);
    if (mesh && mesh.metadata?.meshType === "atom") {
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
    if (!this.startAtom || pointerInfo.event.buttons !== 1) return;

    // Attempt to magnet to another atom under cursor
    const hit = this.pick_mesh("atom");
    let hover: AbstractMesh | null = null;

    // [Branch] Cursor over another atom & not the start atom → lock hover target
    if (hit && hit.metadata?.meshType === "atom") {
      if (hit && hit !== this.startAtom) hover = hit;
    }

    // Update highlight only if changed
    if (hover !== this.hoverAtom) {
      this.hoverAtom = hover;
      this.highlightAtom(hover);
      // No need to keep preview atom when snapping to an existing atom
      if (hover) this.previews.showAtom(new Vector3(0, 0, 0)); // no-op position (will be hidden by not drawing)
    }

    if (hover) {
      // [Branch] Snapped to existing atom: show bond preview from start → hover
      const path = [
        new Vector3(this.startAtom.position.x, this.startAtom.position.y, this.startAtom.position.z),
        new Vector3(hover.position.x, hover.position.y, hover.position.z),
      ];
      this.previews.showBond(path);
    } else {
      // [Branch] Not over an atom: show a preview atom + bond from start → preview point
      const xyz = pointOnScreenAlignedPlane(
        this.world.scene,
        this.world.camera,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY
      );
      this.previews.showAtom(xyz);
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
      if (this.hoverAtom) {
        // Case A: create bond between two existing atoms
        this.executeAndStage(EditCommandType.DrawBond, {
          start: [this.startAtom.position.x, this.startAtom.position.y, this.startAtom.position.z],
          end: [this.hoverAtom.position.x, this.hoverAtom.position.y, this.hoverAtom.position.z],
          options: { order: this.bondOrder },
        });
      } else {
        // Case B: create a new atom at preview position + a bond from start
        const xyz = pointOnScreenAlignedPlane(
          this.world.scene,
          this.world.camera,
          pointerInfo.event.clientX,
          pointerInfo.event.clientY
        );
        const atomName = makeId("atom");

        // draw atom
        this.executeAndStage(EditCommandType.DrawAtom, {
          name: atomName,
          element: this.element,
          position: Vector3.FromArray([xyz.x, xyz.y, xyz.z]),
          options: {},
        });
        // draw bond
        this.executeAndStage(EditCommandType.DrawBond, {
          start: Vector3.FromArray([this.startAtom.position.x, this.startAtom.position.y, this.startAtom.position.z]),
          end: Vector3.FromArray([xyz.x, xyz.y, xyz.z]),
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
      console.log("Picked mesh on right click:", hit);
      if (hit && hit.metadata?.meshType === "atom") {
        // [Branch] Right-click on atom → delete
        console.log("Deleting atom:", hit);
        this.executeAndStage(EditCommandType.DeleteAtom, { atomId: hit.metadata.atomId ?? hit.uniqueId });
      } else if (!hit) {
        // [Branch] Right-click on blank → open menu
        pointerInfo.event.preventDefault();
        console.log("Showing context menu");
        this.menu?.show(pointerInfo.event.clientX, pointerInfo.event.clientY);
      }
    }
  }

  protected override _on_right_up(pointerInfo: PointerInfo): void {
    
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
    console.log("Redo:", redone.command);
  }

  _on_press_ctrl_s(): void {
    this.saveToFrame();
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
    this.menu?.show(x, y);
  }

  protected hideContextMenu(): void {
    this.menu?.hide();
  }
}

export { EditMode, EditModeMenu, MeshPool, PreviewManager, EditCommandType };
