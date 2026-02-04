import {
  type AbstractMesh,
  Color3,
  type Mesh,
  MeshBuilder,
  type PointerInfo,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Molvis } from "@molvis/core";
import { CompositeCommand } from "../commands/composite";
import {
  DeleteAtomCommand,
  DeleteBondCommand,
  DrawAtomCommand,
  DrawBondCommand,
} from "../commands/draw";
import type { Artist } from "../core/artist";
import { syncSceneToFrame } from "../core/scene_sync";
import { ContextMenuController } from "../ui/menus/controller";
import { logger } from "../utils/logger";
import { BaseMode, ModeType } from "./base";
import { CommonMenuItems } from "./menu_items";
import type { HitResult, MenuItem } from "./types";
import { pointOnScreenAlignedPlane } from "./utils";

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
    hit: HitResult | null,
    isDragging: boolean,
  ): boolean {
    return !isDragging && (!hit || hit.type === "empty");
  }

  protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
    const items: MenuItem[] = [];
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
        ],
        value: this.mode.element,
      },
      action: (ev: Event) => {
        this.mode.element = ev.value;
      },
    });
    items.push({ type: "separator" });
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
      action: (ev: Event) => {
        this.mode.bondOrder = ev.value;
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

    const xyz = pointOnScreenAlignedPlane(
      this.world.scene,
      this.world.camera,
      pointerInfo.event.clientX,
      pointerInfo.event.clientY,
      startPos,
    );

    const hit = await this.pickHit();
    let hover: AbstractMesh | null = null;
    let hoverIndex = -1;

    if (hit && hit.type === "atom" && hit.mesh && hit.mesh !== this.startAtom) {
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
      const xyz = pointOnScreenAlignedPlane(
        this.world.scene,
        this.world.camera,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
        startPos, // Use correct anchor
      );

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

        this.app.commandManager.execute(
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

        // 3. Execute Composite
        this.app.commandManager.execute(
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
      const xyz = pointOnScreenAlignedPlane(
        this.world.scene,
        this.world.camera,
        pointerInfo.event.clientX,
        pointerInfo.event.clientY,
      );
      const atomName = makeId("atom");
      const atomId = this.app.world.sceneIndex.getNextAtomId();
      this.app.commandManager.execute(
        new DrawAtomCommand(
          this.app,
          Vector3.FromArray([xyz.x, xyz.y, xyz.z]),
          {
            element: this.element,
            name: atomName,
            atomId,
          },
        ),
      );
      this.pendingAtom = false;
      return;
    }

    if (isLeft && this.pendingAtom) {
      this.pendingAtom = false;
      return;
    }
  }

  /**
   * Handle right-click on atoms/bonds to delete them.
   */
  override onRightClickNotConsumed(
    _pointerInfo: PointerInfo,
    hit: HitResult | null,
  ): void {
    if (!hit || !hit.metadata) return;

    if (hit.type === "atom" && hit.metadata.type === "atom") {
      const atomId = hit.metadata.atomId;
      // Clear highlight before modifying geometry (indices might change)
      this.app.world.highlighter.clearAll();
      // Delete atom (and connected bonds via Command logic)
      this.app.commandManager.execute(new DeleteAtomCommand(this.app, atomId));
    } else if (hit.type === "bond" && hit.metadata.type === "bond") {
      const bondId = hit.metadata.bondId;
      this.app.world.highlighter.clearAll();
      this.app.commandManager.execute(new DeleteBondCommand(this.app, bondId));
    }
  }

  _on_press_ctrl_z(): void {
    this.app.commandManager.undo();
  }
  _on_press_ctrl_y(): void {
    this.app.commandManager.redo();
  }
  _on_press_ctrl_s(): void {
    this.saveToFrame();
  }

  private saveToFrame(): void {
    const frame = this.app.system.frame;
    if (!frame) {
      logger.warn("[EditMode] No Frame loaded, cannot save");
      return;
    }
    logger.info("[EditMode] Saving scene to Frame...");
    syncSceneToFrame(this.world.sceneIndex, frame);
    logger.info("[EditMode] Successfully saved to Frame");
  }

  public finish() {
    this.startAtom = null;
    this.startAtomIndex = -1;
    this.pendingAtom = false;
    this.hoverAtom = null;
    this.previews.clear();
    super.finish();
  }
}

export { EditMode, PreviewManager };
