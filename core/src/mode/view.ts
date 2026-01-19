import { BaseMode, ModeType } from "./base";
import type { MolvisApp } from "../core/app";
import type { PointerInfo } from "@babylonjs/core";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";
import { CommonMenuItems } from "./menu_items";

/**
 * Context menu controller for View mode.
 * Shows menu on any right-click (if not dragging).
 */
class ViewModeContextMenu extends ContextMenuController {
  constructor(
    app: MolvisApp,
    private mode: ViewMode
  ) {
    super(app, "molvis-view-menu");
  }

  protected shouldShowMenu(_hit: HitResult | null, isDragging: boolean): boolean {
    // Show menu on any right-click (if not dragging)
    return !isDragging;
  }

  protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
    const items: MenuItem[] = [];

    // Reset Camera (using common item)
    items.push(CommonMenuItems.resetCamera(this.app));

    // Enable/Disable Grid
    items.push({
      type: "binding",
      bindingConfig: {
        view: "checkbox",
        label: "Grid",
        options: [
          { text: "On", value: true },
          { text: "Off", value: false },
        ],
        value: this.mode.isGridEnabled(),
      },
      action: (ev: any) => {
        const enabled = ev.value === true || ev.value === "true";
        this.mode.setGridEnabled(enabled);
      }
    });

    items.push(CommonMenuItems.separator());

    // Snapshot (using common item)
    items.push(CommonMenuItems.snapshot(this.app));

    return items;
  }
}

class ViewMode extends BaseMode {
  private lastClickTime: number = 0;
  private doubleClickThreshold: number = 300; // ms

  constructor(app: MolvisApp) {
    super(ModeType.View, app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new ViewModeContextMenu(this.app, this);
  }

  public resetCamera(): void {
    if (this.app.world.camera) {
      this.app.world.camera.restoreState();
    }
  }

  public isGridEnabled(): boolean {
    return this.app.world.grid ? this.app.world.grid.isEnabled : false;
  }

  public setGridEnabled(enabled: boolean): void {
    if (this.app.world.grid) {
      if (enabled) {
        this.app.world.grid.enable();
      } else {
        this.app.world.grid.disable();
      }
    }
  }

  /**
   * Start ViewMode - activate 3D scene helpers
   */
  public start(): void {
    console.log('[ViewMode] start() called');
    super.start();

    // Invalidate highlights for mode switch (View uses thin instances)
    this.app.world.highlighter.invalidateAndRebuild();
  }

  /**
   * Finish ViewMode - deactivate 3D scene helpers
   */
  public finish(): void {
    this.world.targetIndicator.hide();

    super.finish();
  }

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);

    // Detect double-click
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    if (timeSinceLastClick < this.doubleClickThreshold &&
      pointerInfo.event.button === 0) { // Left button only
      this.handleDoubleClick();
    }

    this.lastClickTime = now;
  }

  /**
   * Handle double-click to set camera target (like Ovito)
   */
  private handleDoubleClick(): void {
    const pickResult = this.world.scene.pick(
      this.world.scene.pointerX,
      this.world.scene.pointerY,
      undefined,
      false,
      this.world.camera
    );

    if (pickResult.hit && pickResult.pickedPoint) {
      // Only set camera target, don't move camera position (Ovito-like behavior)
      this.world.camera.setTarget(pickResult.pickedPoint);

      // Show target indicator at the picked point
      this.world.targetIndicator.show(pickResult.pickedPoint);
    }
  }

  override _on_pointer_up(pointerInfo: PointerInfo) {
    super._on_pointer_up(pointerInfo);
  }

  override _on_pointer_move(_pointerInfo: PointerInfo) {
    // ViewMode inherits atom info display functionality from BaseMode
    super._on_pointer_move(_pointerInfo);
  }
}

export { ViewMode };
