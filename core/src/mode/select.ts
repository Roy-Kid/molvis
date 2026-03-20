import { Matrix, type PointerInfo, Vector3 } from "@babylonjs/core";

import type { MolvisApp as Molvis } from "../app";
import { SelectModifier } from "../modifiers/SelectModifier";

import type { SelectionOp } from "../selection_manager";
import { makeSelectionKey } from "../selection_manager";
import { pointInPolygon, simplifyPolyline, type Point2D } from "../selection/fence";
import { ContextMenuController } from "../ui/menus/controller";
import { isCtrlOrMeta } from "../utils/platform";
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
  private _fenceOverlay: SVGSVGElement | null = null;
  private _fenceOverlayPath: SVGPathElement | null = null;

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
    this.ensureFenceOverlay();
    this.updateFenceOverlay();
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
    this.disposeFenceOverlay();
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
    this.disposeFenceOverlay();
    super.finish();
  }

  override async _on_left_down(pointerInfo: PointerInfo): Promise<void> {
    if (!this._fenceActive) return;

    this._fenceDrawing = true;
    this._fencePath = [
      { x: pointerInfo.event.offsetX, y: pointerInfo.event.offsetY },
    ];
    this.updateFenceOverlay();
  }

  override async _on_left_up(pointerInfo: PointerInfo): Promise<void> {
    if (this._fenceActive && this._fenceDrawing) {
      await this.completeFenceSelect(pointerInfo);
      return;
    }

    // Normal click-select behavior
    const isCtrl = isCtrlOrMeta(pointerInfo.event);

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

    const bondKey =
      meta.type === "bond"
        ? this.app.world.sceneIndex.getSelectionKeyForBond(meta.bondId) ?? key
        : key;
    const targetKeys = meta.type === "bond" ? [bondKey] : [key];
    const isSelected = targetKeys.some((selectionKey) =>
      this.app.world.selectionManager.isSelected(selectionKey),
    );
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
        op = { type: "toggle", bonds: targetKeys };
      } else if (isSelected) {
        op = { type: "remove", bonds: targetKeys };
      } else {
        op = { type: "replace", bonds: targetKeys };
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
      this.updateFenceOverlay();
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
  private async completeFenceSelect(pointerInfo: PointerInfo): Promise<void> {
    // Add final point and close
    this._fencePath.push({
      x: pointerInfo.event.offsetX,
      y: pointerInfo.event.offsetY,
    });
    this.updateFenceOverlay();

    const polygon = simplifyPolyline(this._fencePath, 3);

    if (polygon.length < 3) {
      this.exitFenceMode();
      return;
    }

    // Project all atoms to screen space and test against polygon
    const selectedIndices = this.projectAndSelect(polygon);
    const selectedBondKeys = this.projectAndSelectBonds(polygon);

    // Apply selection based on modifier keys
    const isShift = pointerInfo.event.shiftKey;
    const isCtrl = isCtrlOrMeta(pointerInfo.event);

    let mode: "replace" | "add" | "remove";
    if (isShift) {
      mode = "add";
    } else if (isCtrl) {
      mode = "remove";
    } else {
      mode = "replace";
    }

    this.app.modifierPipeline.addModifier(
      new SelectModifier(`fence-select-${Date.now()}`, selectedIndices, undefined, mode),
    );
    await this.app.applyPipeline({ fullRebuild: true });

    const currentAtoms = [...this.app.world.selectionManager.getState().atoms];
    if (mode === "add") {
      this.app.world.selectionManager.apply({
        type: "add",
        bonds: selectedBondKeys,
      });
    } else if (mode === "remove") {
      this.app.world.selectionManager.apply({
        type: "remove",
        bonds: selectedBondKeys,
      });
    } else {
      this.app.world.selectionManager.apply({
        type: "replace",
        atoms: currentAtoms,
        bonds: selectedBondKeys,
      });
    }
    this.exitFenceMode();
  }

  /**
   * Project all atom positions to screen space and return selection keys
   * for atoms inside the fence polygon.
   */
  private projectAndSelect(polygon: Point2D[]): number[] {
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
    const worldMatrix = Matrix.Identity();

    const atomCount = atoms.nrows();
    const tmpVec = new Vector3();
    const selectedIndices: number[] = [];

    for (let i = 0; i < atomCount; i++) {
      tmpVec.set(xCoords[i], yCoords[i], zCoords[i]);
      const projected = Vector3.Project(
        tmpVec,
        worldMatrix,
        transformMatrix,
        viewportMatrix,
      );

      if (pointInPolygon({ x: projected.x, y: projected.y }, polygon)) {
        selectedIndices.push(i);
      }
    }

    return selectedIndices;
  }

  private projectAndSelectBonds(polygon: Point2D[]): string[] {
    const scene = this.app.world.scene;
    const camera = scene.activeCamera;
    if (!camera) return [];

    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewportMatrix = camera.viewport.toGlobal(width, height);
    const transformMatrix = scene.getTransformMatrix();
    const worldMatrix = Matrix.Identity();
    const tmpVec = new Vector3();
    const selected = new Set<string>();

    for (const bondId of this.app.world.sceneIndex.metaRegistry.bonds.getAllIds()) {
      const meta = this.app.world.sceneIndex.metaRegistry.bonds.getMeta(bondId);
      if (!meta) continue;

      tmpVec.set(
        (meta.start.x + meta.end.x) * 0.5,
        (meta.start.y + meta.end.y) * 0.5,
        (meta.start.z + meta.end.z) * 0.5,
      );
      const projected = Vector3.Project(
        tmpVec,
        worldMatrix,
        transformMatrix,
        viewportMatrix,
      );

      if (!pointInPolygon({ x: projected.x, y: projected.y }, polygon)) {
        continue;
      }

      const key = this.app.world.sceneIndex.getSelectionKeyForBond(meta.bondId);
      if (key) {
        selected.add(key);
      }
    }

    return [...selected];
  }

  private ensureFenceOverlay(): void {
    if (this._fenceOverlay) {
      this.syncFenceOverlayViewport();
      return;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-role", "molvis-fence-overlay");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";
    svg.style.zIndex = "20";

    const path = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path.setAttribute("fill", "#60a5fa");
    path.setAttribute("fill-opacity", "0.10");
    path.setAttribute("stroke", "#60a5fa");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");

    svg.appendChild(path);
    this.app.uiContainer.appendChild(svg);

    this._fenceOverlay = svg;
    this._fenceOverlayPath = path;
    this.syncFenceOverlayViewport();
  }

  private syncFenceOverlayViewport(): void {
    if (!this._fenceOverlay) return;

    const width = this.app.canvas.clientWidth || this.app.displaySize.width || 1;
    const height =
      this.app.canvas.clientHeight || this.app.displaySize.height || 1;
    this._fenceOverlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this._fenceOverlay.setAttribute("preserveAspectRatio", "none");
  }

  private updateFenceOverlay(): void {
    if (!this._fenceOverlayPath) return;

    this.syncFenceOverlayViewport();

    if (this._fencePath.length < 2) {
      this._fenceOverlayPath.setAttribute("d", "");
      return;
    }

    const d = this._fencePath
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    const first = this._fencePath[0];
    const closedPath = `${d} L ${first.x.toFixed(2)} ${first.y.toFixed(2)} Z`;
    this._fenceOverlayPath.setAttribute("d", closedPath);
  }

  private disposeFenceOverlay(): void {
    this._fenceOverlayPath = null;
    if (this._fenceOverlay) {
      this._fenceOverlay.remove();
      this._fenceOverlay = null;
    }
  }
}

export { SelectMode };
