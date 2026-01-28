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
    const gridEnabled = this.mode.isGridEnabled();
    items.push({
      type: "button",
      title: gridEnabled ? "Grid On" : "Grid Off",
      action: () => {
        this.mode.setGridEnabled(!gridEnabled);
      }
    });

    return CommonMenuItems.appendCommonTail(items, this.app);
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
    super.start();

    // Invalidate highlights for mode switch (View uses thin instances)
    this.app.world.highlighter.invalidateAndRebuild();

    // Listen for frame changes (from System or UI)
    this.app.events.on('frame-change', this.onFrameChange);
  }

  /**
   * Finish ViewMode - deactivate 3D scene helpers
   */
  public finish(): void {
    this.app.events.off('frame-change', this.onFrameChange);
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

  private onFrameChange = () => {
    this.redrawFrame();
  };

  override _on_press_q(): void {
    this.app.prevFrame();
  }

  override _on_press_e(): void {
    this.app.nextFrame();
  }

  private async redrawFrame() {
    const frame = this.app.system.frame;

    try {
      const { UpdateFrameCommand } = await import("../commands/update_frame");
      const updateCmd = new UpdateFrameCommand(this.app, { frame });
      const result = await updateCmd.do();

      if (result.success) {
        return;
      }
      // console.log("UpdateFrame failed, falling back to DrawFrame:", result.reason);
    } catch (e) {
      // Ignore error and fall back
      // console.warn("UpdateFrameCommand error:", e);
    }

    // Fallback to full rebuild
    const { DrawFrameCommand } = await import("../commands/draw");
    const cmd = new DrawFrameCommand(this.app, {
      frame
    });
    await cmd.do();
  }
}

export { ViewMode };
