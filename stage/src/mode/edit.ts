import {
  type AbstractMesh,
  Color3,
  type Mesh,
  MeshBuilder,
  type PointerInfo,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Frame } from "@molcrafts/molvis-core/molrs";
import type { MolvisApp as Molvis } from "../app";
import type { Artist } from "../artist";
import { CompositeCommand } from "../commands/composite";
import {
  DeleteAtomCommand,
  DeleteBondCommand,
  DrawAtomCommand,
  DrawBondCommand,
} from "../commands/draw";
import { PlaceMoleculeCommand } from "../commands/place_molecule";
import { ContextMenuController } from "../ui/menus/controller";
import { BaseMode, ModeType } from "./base";
import { CommonMenuItems } from "./menu_items";
import type { BindingEvent, HitResult, MenuItem } from "./types";

/**
 * =============================
 * Refactored Edit Mode (TypeScript)
 * =============================
 */

/* ----------------------------------
 * Types & Interfaces
 * ---------------------------------- */

function makeId(prefix = "atom"): string {
  return `${prefix}:${Math.random().toString(36).substring(2, 6)}`;
}

/* ----------------------------------
 * Preview Manager
 * ---------------------------------- */

class PreviewManager {
  private previewAtom: Mesh | null = null;
  private previewBond1: Mesh | null = null;
  private previewBond2: Mesh | null = null;

  constructor(private app: Molvis) {}

  private get scene() {
    return this.app.scene;
  }

  showAtom(position: Vector3, opacity = 1.0, diameter = 0.5) {
    if (!this.previewAtom) {
      this.previewAtom = MeshBuilder.CreateSphere(
        "preview_atom",
        { diameter },
        this.scene,
      );
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
      this.previewAtom.position = position;
      this.previewAtom.isVisible = true;
      const mat = this.previewAtom.material as StandardMaterial;
      if (mat) {
        mat.alpha = opacity;
      }
    }
  }

  hideAtom() {
    if (this.previewAtom) {
      this.previewAtom.isVisible = false;
    }
  }

  showBond(path: Vector3[], color1?: Color3, color2?: Color3) {
    const start = path[0];
    const end = path[1];
    const mid = Vector3.Center(start, end);

    this.updateBondSegment(
      1,
      [start, mid],
      color1 ?? new Color3(0.8, 0.8, 0.8),
    );
    this.updateBondSegment(2, [mid, end], color2 ?? new Color3(0.8, 0.8, 0.8));
  }

  private updateBondSegment(index: 1 | 2, path: Vector3[], color: Color3) {
    const meshName = `preview_bond_${index}`;
    let mesh = index === 1 ? this.previewBond1 : this.previewBond2;

    if (mesh) {
      MeshBuilder.CreateTube(meshName, { path, instance: mesh }, this.scene);
      (mesh.material as StandardMaterial).diffuseColor = color;
      mesh.isVisible = true;
    } else {
      mesh = MeshBuilder.CreateTube(
        meshName,
        { path, radius: 0.05, updatable: true },
        this.scene,
      );
      const mat = new StandardMaterial(`${meshName}_mat`, this.scene);
      mat.diffuseColor = color;
      mat.specularColor = new Color3(0.1, 0.1, 0.1);
      mesh.material = mat;
      mesh.isPickable = false;

      if (index === 1) this.previewBond1 = mesh;
      else this.previewBond2 = mesh;
    }
  }

  hideBond() {
    if (this.previewBond1) this.previewBond1.isVisible = false;
    if (this.previewBond2) this.previewBond2.isVisible = false;
  }

  clear() {
    if (this.previewAtom) {
      this.previewAtom.dispose();
      this.previewAtom = null;
    }
    if (this.previewBond1) {
      this.previewBond1.dispose();
      this.previewBond1 = null;
    }
    if (this.previewBond2) {
      this.previewBond2.dispose();
      this.previewBond2 = null;
    }
  }
}

/* ----------------------------------
 * EditMode Context Menu
 * ---------------------------------- */

class EditModeContextMenu extends ContextMenuController {
  constructor(
    app: Molvis,
    private mode: EditMode,
  ) {
    super(app, "molvis-edit-menu");
  }

  protected shouldShowMenu(
    _hit: HitResult | null,
    isDragging: boolean,
  ): boolean {
    // Menu on any non-drag right-click; atom/bond Delete lives in the menu
    // (no instant-delete on right-up).
    return !isDragging;
  }

  protected buildMenuItems(hit: HitResult | null): MenuItem[] {
    const items: MenuItem[] = [];
    const header = hit ? CommonMenuItems.hitLabel(hit) : null;
    if (header) {
      items.push(header);
      items.push(CommonMenuItems.separator());
    }

    if (hit?.type === "atom") {
      const atomId = hit.metadata.atomId;
      items.push(
        CommonMenuItems.button("Delete", () => {
          this.app.world.highlighter.clearAll();
          void this.app.commandManager.execute(
            new DeleteAtomCommand(this.app, atomId),
          );
        }),
      );
      items.push(CommonMenuItems.separator());
    } else if (hit?.type === "bond") {
      const bondId = hit.metadata.bondId;
      items.push(
        CommonMenuItems.button("Delete", () => {
          this.app.world.highlighter.clearAll();
          void this.app.commandManager.execute(
            new DeleteBondCommand(this.app, bondId),
          );
        }),
      );
      items.push(CommonMenuItems.separator());
    }

    // Tool settings (≤2-word labels).
    items.push({
      type: "binding",
      bindingConfig: {
        view: "element-picker",
        label: "Element",
        value: this.mode.element,
      },
      action: (ev: BindingEvent) => {
        this.mode.element = String(ev.value);
      },
    });
    items.push({
      type: "binding",
      bindingConfig: {
        view: "list",
        label: "Bond Order",
        options: [
          { text: "1", value: 1 },
          { text: "2", value: 2 },
          { text: "3", value: 3 },
        ],
        value: this.mode.bondOrder,
      },
      action: (ev: BindingEvent) => {
        this.mode.bondOrder = Number(ev.value);
      },
    });
    return CommonMenuItems.appendCommonTail(items, this.app);
  }
}

/* ----------------------------------
 * EditMode
 * ---------------------------------- */

class EditMode extends BaseMode {
  // State machine for left-button operations
  private startAtom: AbstractMesh | null = null;
  private startAtomIndex = -1; // Track thin instance index
  private hoverAtom: AbstractMesh | null = null;
  private hoverAtomIndex = -1; // Track thin instance index
  private pendingAtom = false;
  private clickedAtom: AbstractMesh | null = null;
  private clickedBond: AbstractMesh | null = null;

  private element_ = "C";
  private bondOrder_ = 1;
  private pendingMolecule_: Frame | null = null;

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
    this.bondOrder_ = v;
  }

  /**
   * Stamp template: each empty-canvas click places a copy at the pointer.
   * Stays armed until replaced, canceled (Esc / set null), or leaving Edit.
   */
  get pendingMolecule(): Frame | null {
    return this.pendingMolecule_;
  }
  set pendingMolecule(frame: Frame | null) {
    // Free the old WASM Frame if overwriting with a different one
    if (this.pendingMolecule_ && this.pendingMolecule_ !== frame) {
      this.pendingMolecule_.free();
    }
    this.pendingMolecule_ = frame;
  }

  constructor(app: Molvis) {
    super(ModeType.Edit, app);

    // Use shared Artist instance from App
    this.artist = app.artist;

    this.previews = new PreviewManager(app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new EditModeContextMenu(this.app, this);
  }

  /**
   * Get the actual position of an atom mesh.
   * Handles both regular atom meshes and thin instance atoms from draw_frame.
   */
  private getAtomPosition(
    atomMesh: AbstractMesh,
    thinInstanceIndex = -1,
  ): Vector3 {
    // Check if this is a thin instance atom (from draw_frame or edit pool)
    if (thinInstanceIndex !== -1) {
      const meta = this.world.sceneIndex.getMeta(
        atomMesh.uniqueId,
        thinInstanceIndex,
      );
      if (meta && meta.type === "atom") {
        return new Vector3(meta.position.x, meta.position.y, meta.position.z);
      }
    }

    // Regular atom mesh - use position directly
    return atomMesh.position.clone();
  }

  override start(): void {
    super.start();
    this.app.world.sceneIndex.promoteFrameToEditPool();
    this.app.world.highlighter.invalidateAndRebuild();
  }

  override async _on_pointer_down(pointerInfo: PointerInfo) {
    if (
      pointerInfo.event.target !==
      this.world.scene.getEngine().getRenderingCanvas()
    )
      return;
    await super._on_pointer_down(pointerInfo);

    const isLeft = pointerInfo.event.button === 0;
    this.clickedAtom = null;
    this.clickedBond = null;

    if (isLeft) {
      // Stamp template (SMILES / sketch / download): same empty-click arm as a
      // lone atom. Do not start bond-drag or bond-select while armed — each
      // non-drag release places a copy (see placeAtPointer). Esc / leave Edit
      // cancels; the template stays armed across placements.
      if (this.pendingMolecule_) {
        this.pendingAtom = true;
        return;
      }

      // Use pickHit directly to get consistent thinInstanceIndex
      const hit = await this.pickHit();

      if (hit && hit.type === "atom" && hit.mesh) {
        this.startAtom = hit.mesh;
        this.startAtomIndex = hit.thinInstanceIndex ?? -1;

        this.clickedAtom = hit.mesh;
        this.world.camera.detachControl();
        this.hoverAtom = null;
        this.hoverAtomIndex = -1;
        return;
      }

      if (hit && hit.type === "bond" && hit.mesh) {
        this.clickedBond = hit.mesh;
        return;
      }

      this.pendingAtom = true;
    }
  }

  override async _on_pointer_move(pointerInfo: PointerInfo) {
    await super._on_pointer_move(pointerInfo);

    if (!this.startAtom) return;

    // Use resolved position as anchor for drag plane
    const startPos = this.getAtomPosition(this.startAtom, this.startAtomIndex);

    const xyz = this.projectPointerOnScreenPlane(startPos);
    if (!xyz) {
      this.previews.hideAtom();
      this.previews.hideBond();
      return;
    }

    const hit = await this.pickHit();
    let hover: AbstractMesh | null = null;
    let hoverIndex = -1;

    const samePickedAtom = Boolean(
      hit &&
        hit.type === "atom" &&
        hit.mesh === this.startAtom &&
        (hit.thinInstanceIndex ?? -1) === this.startAtomIndex,
    );

    if (hit && hit.type === "atom" && hit.mesh && !samePickedAtom) {
      hover = hit.mesh;
      hoverIndex = hit.thinInstanceIndex ?? -1;
    }

    // Resolve start color
    let startColor = Color3.Gray();
    const startMeta = this.world.sceneIndex.getMeta(
      this.startAtom.uniqueId,
      this.startAtomIndex !== -1 ? this.startAtomIndex : undefined,
    );
    if (startMeta && startMeta.type === "atom") {
      const style = this.app.styleManager.getAtomStyle(startMeta.element);
      startColor = Color3.FromHexString(style.color);
    }

    if (hover) {
      this.hoverAtom = hover;
      this.hoverAtomIndex = hoverIndex;
      this.previews.hideAtom();

      const hoverPos = this.getAtomPosition(hover, hoverIndex);
      const path = [startPos, hoverPos];

      // Resolve hover color
      let hoverColor = Color3.Gray();
      const meta = this.world.sceneIndex.getMeta(
        hover.uniqueId,
        hoverIndex !== -1 ? hoverIndex : undefined,
      );
      if (meta && meta.type === "atom") {
        const style = this.app.styleManager.getAtomStyle(meta.element);
        hoverColor = Color3.FromHexString(style.color);
      }

      this.previews.showBond(path, startColor, hoverColor);
    } else {
      this.hoverAtom = null;
      this.hoverAtomIndex = -1;
      this.previews.showAtom(xyz, 0.5, 0.5);
      const path = [startPos, xyz];

      // Resolve new atom color
      const style = this.app.styleManager.getAtomStyle(this.element);
      const newColor = Color3.FromHexString(style.color);

      this.previews.showBond(path, startColor, newColor);
    }
  }

  override async _on_pointer_up(pointerInfo: PointerInfo) {
    if (
      pointerInfo.event.target !==
      this.world.scene.getEngine().getRenderingCanvas()
    )
      return;
    await super._on_pointer_up(pointerInfo);
    const isLeft = pointerInfo.event.button === 0;

    if (
      isLeft &&
      this.clickedAtom &&
      !this._is_dragging &&
      this.startAtom === this.clickedAtom
    ) {
      this.world.camera.attachControl(
        this.world.scene.getEngine().getRenderingCanvas(),
        false,
      );
      this.startAtom = null;
      this.startAtomIndex = -1;
      this.clickedAtom = null;
      return;
    }

    if (isLeft && this.clickedBond && !this._is_dragging) {
      this.clickedBond = null;
      return;
    }

    if (isLeft && this.startAtom) {
      const startPos = this.getAtomPosition(
        this.startAtom,
        this.startAtomIndex,
      );
      const xyz = this.projectPointerOnScreenPlane(startPos);
      if (!xyz) {
        this.world.camera.attachControl(
          this.world.scene.getEngine().getRenderingCanvas(),
          false,
        );
        this.previews.clear();
        this.startAtom = null;
        this.startAtomIndex = -1;
        this.hoverAtom = null;
        this.hoverAtomIndex = -1;
        this.clickedAtom = null;
        return;
      }

      if (this.hoverAtom) {
        const endPos = this.getAtomPosition(
          this.hoverAtom,
          this.hoverAtomIndex,
        );

        // Resolve atom IDs using indices
        const startIdx =
          this.startAtomIndex !== -1 ? this.startAtomIndex : undefined;
        const startMeta = this.world.sceneIndex.getMeta(
          this.startAtom.uniqueId,
          startIdx,
        );
        const startId =
          startMeta?.type === "atom"
            ? startMeta.atomId
            : this.startAtom.uniqueId;

        const endIdx =
          this.hoverAtomIndex !== -1 ? this.hoverAtomIndex : undefined;
        const endMeta = this.world.sceneIndex.getMeta(
          this.hoverAtom.uniqueId,
          endIdx,
        );
        const endId =
          endMeta?.type === "atom" ? endMeta.atomId : this.hoverAtom.uniqueId;

        void this.app.commandManager.execute(
          new DrawBondCommand(this.app, startPos, endPos, {
            order: this.bondOrder,
            atomId1: startId,
            atomId2: endId,
          }),
        );
      } else if (this._is_dragging) {
        const atomName = makeId("atom");
        const atomId = this.app.world.sceneIndex.getNextAtomId();

        // 1. Prepare Atom Command
        const atomCmd = new DrawAtomCommand(this.app, xyz, {
          element: this.element,
          name: atomName,
          atomId,
        });

        // Resolve start ID
        const startIdx =
          this.startAtomIndex !== -1 ? this.startAtomIndex : undefined;
        const startMeta = this.world.sceneIndex.getMeta(
          this.startAtom.uniqueId,
          startIdx,
        );
        const startId =
          startMeta?.type === "atom"
            ? startMeta.atomId
            : this.startAtom.uniqueId;

        // 2. Prepare Bond Command
        const bondCmd = new DrawBondCommand(this.app, startPos, xyz, {
          order: this.bondOrder,
          atomId1: startId,
          atomId2: atomId, // Use semantic ID
        });

        // 3. Execute Composite (working tree only — commitScene is Ctrl+S)
        void this.app.commandManager.execute(
          new CompositeCommand(this.app, [atomCmd, bondCmd]),
        );
      }

      this.world.camera.attachControl(
        this.world.scene.getEngine().getRenderingCanvas(),
        false,
      );
      this.previews.clear();
      this.startAtom = null;
      this.startAtomIndex = -1;
      this.hoverAtom = null;
      this.hoverAtomIndex = -1;
      this.clickedAtom = null;
      return;
    }

    if (isLeft && this.pendingAtom && !this._is_dragging) {
      // Shared with lone-atom placement: screen-plane hit under the pointer.
      this.placeAtPointer();
      this.pendingAtom = false;
      return;
    }

    if (isLeft && this.pendingAtom) {
      this.pendingAtom = false;
      return;
    }
  }

  /**
   * Place a stamp template (SMILES / sketch / download) or a single atom at
   * the pointer. Position uses the shared screen-plane hit
   * (`projectPointerOnScreenPlane` → `resolvePointerSpacePosition`).
   *
   * Stamp mode keeps {@link pendingMolecule} armed so the same template can
   * be placed at multiple click locations. Ownership of the WASM Frame stays
   * with EditMode until replace / Esc / leave Edit.
   */
  private placeAtPointer(): void {
    const target = this.projectPointerOnScreenPlane();
    if (!target) return;

    if (this.pendingMolecule_) {
      // PlaceMoleculeCommand snapshots atom/bond data in do(); the Frame is
      // only read, so the same template can be stamped repeatedly.
      void this.app.commandManager.execute(
        new PlaceMoleculeCommand(
          this.app,
          this.pendingMolecule_,
          target.clone(),
        ),
      );
      return;
    }

    const atomName = makeId("atom");
    const atomId = this.app.world.sceneIndex.getNextAtomId();
    void this.app.commandManager.execute(
      new DrawAtomCommand(this.app, target.clone(), {
        element: this.element,
        name: atomName,
        atomId,
      }),
    );
  }

  /**
   * Right-click on atoms/bonds is consumed by the context menu (Del item).
   * No instant-delete path.
   */
  override onRightClickNotConsumed(
    _pointerInfo: PointerInfo,
    _hit: HitResult | null,
  ): void {
    // no-op — destructive actions only via menu
  }

  _on_press_ctrl_z(): void {
    void this.app.commandManager.undo();
  }
  _on_press_ctrl_y(): void {
    void this.app.commandManager.redo();
  }
  // Ctrl+S → BaseMode._on_press_ctrl_s (global commitScene)

  /** Esc cancels the stamp template so further clicks place lone atoms again. */
  protected override _on_press_escape(): void {
    this.pendingAtom = false;
    if (this.pendingMolecule_) {
      this.pendingMolecule_.free();
      this.pendingMolecule_ = null;
    }
    this.previews.clear();
  }

  public finish() {
    this.startAtom = null;
    this.startAtomIndex = -1;
    this.pendingAtom = false;
    if (this.pendingMolecule_) {
      this.pendingMolecule_.free();
      this.pendingMolecule_ = null;
    }
    this.hoverAtom = null;
    this.previews.clear();
    // Park working tree across modes — do not commit or discard here.
    // HEAD is only updated via commitScene (Ctrl+S).
    super.finish();
  }
}

export { EditMode, PreviewManager };
