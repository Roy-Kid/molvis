import { type PointerInfo, Vector3 } from "@babylonjs/core";

import type { MolvisApp as Molvis } from "../app";

import type { SelectionOp } from "../selection_manager";
import { makeSelectionKey } from "../selection_manager";
import { pointInPolygon, simplifyPolyline, type Point2D } from "../selection/fence";
import { ContextMenuController } from "../ui/menus/controller";
import { BaseMode, ModeType } from "./base";
import { CommonMenuItems } from "./menu_items";
import type { HitResult, MenuItem } from "./types";

/**
 * Context menu controller for Select mode.
 */
class SelectModeContextMenu extends ContextMenuController {
  constructor(app: Molvis) {
    super(app, "molvis-select-menu");
  }

  protected shouldShowMenu(
    _hit: HitResult | null,
    isDragging: boolean,
  ): boolean {
    return !isDragging;
  }

  protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
    const items: MenuItem[] = [CommonMenuItems.clearSelection(this.app)];
    return CommonMenuItems.appendCommonTail(items, this.app);
  }
}

/**
 * SelectMode with unified selection system.
 * Supports click-select and fence (lasso) select.
 */
class SelectMode extends BaseMode {
  private _fenceActive = false;
  private _fenceDrawing = false;
  private _fencePath: Point2D[] = [];

  constructor(app: Molvis) {
    super(ModeType.Select, app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new SelectModeContextMenu(this.app);
  }

  get isFenceActive(): boolean {
    return this._fenceActive;
  }

  /**
   * Enter fence select mode. Disables camera and prepares for drawing.
   */
  enterFenceMode(): void {
    this._fenceActive = true;
    this._fenceDrawing = false;
    this._fencePath = [];
    this.app.world.camera.detachControl();
    this.app.events.emit("fence-select-change", true);
  }

  /**
   * Exit fence select mode. Re-enables camera.
   */
  exitFenceMode(): void {
    this._fenceActive = false;
    this._fenceDrawing = false;
    this._fencePath = [];
    const canvas = this.app.world.scene.getEngine().getRenderingCanvas();
    if (canvas) {
      this.app.world.camera.attachControl(canvas, true);
    }
    this.app.events.emit("fence-select-change", false);
  }

  override start(): void {
    super.start();
    this.app.world.highlighter.invalidateAndRebuild();
  }

  override finish(): void {
    if (this._fenceActive) {
      this.exitFenceMode();
    }
    this.app.world.selectionManager.apply({ type: "clear" });
    super.finish();
  }

  override async _on_left_down(pointerInfo: PointerInfo): Promise<void> {
    if (!this._fenceActive) return;

    this._fenceDrawing = true;
    this._fencePath = [
      { x: pointerInfo.event.offsetX, y: pointerInfo.event.offsetY },
    ];
  }

  override async _on_left_up(pointerInfo: PointerInfo): Promise<void> {
    if (this._fenceActive && this._fenceDrawing) {
      this.completeFenceSelect(pointerInfo);
      return;
    }

    // Normal click-select behavior
    const isCtrl = pointerInfo.event.ctrlKey;

    const hit = await this.pickHit();

    if (!hit || (hit.type !== "atom" && hit.type !== "bond")) {
      if (!isCtrl) {
        this.app.world.selectionManager.apply({ type: "clear" });
      }
      return;
    }

    const mesh = hit.mesh;
    const thinIndex = hit.thinInstanceIndex ?? -1;
    if (!mesh) return;

    const meta = hit.metadata;

    const key = makeSelectionKey(
      mesh.uniqueId,
      thinIndex >= 0 ? thinIndex : undefined,
    );

    const isSelected = this.app.world.selectionManager.isSelected(key);
    let op: SelectionOp;

    if (meta.type === "atom") {
      if (isCtrl) {
        op = { type: "toggle", atoms: [key] };
      } else if (isSelected) {
        op = { type: "remove", atoms: [key] };
      } else {
        op = { type: "replace", atoms: [key] };
      }
    } else {
      if (isCtrl) {
        op = { type: "toggle", bonds: [key] };
      } else if (isSelected) {
        op = { type: "remove", bonds: [key] };
      } else {
        op = { type: "replace", bonds: [key] };
      }
    }

    this.app.world.selectionManager.apply(op);
  }

  override async _on_pointer_move(pointerInfo: PointerInfo): Promise<void> {
    if (this._fenceActive && this._fenceDrawing) {
      this._fencePath.push({
        x: pointerInfo.event.offsetX,
        y: pointerInfo.event.offsetY,
      });
      return;
    }
    return super._on_pointer_move(pointerInfo);
  }

  protected override _on_press_escape(): void {
    if (this._fenceActive) {
      this.exitFenceMode();
    }
  }

  override _on_pointer_pick(_pointerInfo: PointerInfo): void {}

  /**
   * Complete fence selection: project all atoms to screen space,
   * test against simplified fence polygon, apply selection.
   */
  private completeFenceSelect(pointerInfo: PointerInfo): void {
    // Add final point and close
    this._fencePath.push({
      x: pointerInfo.event.offsetX,
      y: pointerInfo.event.offsetY,
    });

    const polygon = simplifyPolyline(this._fencePath, 3);

    if (polygon.length < 3) {
      this.exitFenceMode();
      return;
    }

    // Project all atoms to screen space and test against polygon
    const selectedKeys = this.projectAndSelect(polygon);

    // Apply selection based on modifier keys
    const isShift = pointerInfo.event.shiftKey;
    const isCtrl = pointerInfo.event.ctrlKey;

    let op: SelectionOp;
    if (isShift) {
      op = { type: "add", atoms: selectedKeys };
    } else if (isCtrl) {
      op = { type: "remove", atoms: selectedKeys };
    } else {
      op = { type: "replace", atoms: selectedKeys };
    }

    this.app.world.selectionManager.apply(op);
    this.exitFenceMode();
  }

  /**
   * Project all atom positions to screen space and return selection keys
   * for atoms inside the fence polygon.
   */
  private projectAndSelect(polygon: Point2D[]): string[] {
    const frame = this.app.system.frame;
    const atoms = frame?.getBlock("atoms");
    if (!atoms) return [];

    const xCoords = atoms.getColumnF32("x");
    const yCoords = atoms.getColumnF32("y");
    const zCoords = atoms.getColumnF32("z");
    if (!xCoords || !yCoords || !zCoords) return [];

    const scene = this.app.world.scene;
    const camera = scene.activeCamera;
    if (!camera) return [];

    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewportMatrix = camera.viewport.toGlobal(width, height);
    const transformMatrix = scene.getTransformMatrix();

    const atomCount = atoms.nrows();
    const tmpVec = new Vector3();
    const selectedKeys: string[] = [];

    for (let i = 0; i < atomCount; i++) {
      tmpVec.set(xCoords[i], yCoords[i], zCoords[i]);
      const projected = Vector3.Project(
        tmpVec,
        transformMatrix,
        transformMatrix,
        viewportMatrix,
      );

      if (pointInPolygon({ x: projected.x, y: projected.y }, polygon)) {
        const key = this.app.world.sceneIndex.getSelectionKeyForAtom(i);
        if (key) selectedKeys.push(key);
      }
    }

    return selectedKeys;
  }
}

export { SelectMode };
