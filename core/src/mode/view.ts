import { type PointerInfo, Vector3 } from "@babylonjs/core";
import type { MolvisApp } from "../core/app";
import { ContextMenuController } from "../ui/menus/controller";
import { BaseMode, ModeType } from "./base";
import { CommonMenuItems } from "./menu_items";
import type { HitResult, MenuItem } from "./types";

/**
 * Context menu controller for View mode.
 * Shows menu on any right-click (if not dragging).
 */
class ViewModeContextMenu extends ContextMenuController {
  constructor(
    app: MolvisApp,
    private mode: ViewMode,
  ) {
    super(app, "molvis-view-menu");
  }

  protected shouldShowMenu(
    _hit: HitResult | null,
    isDragging: boolean,
  ): boolean {
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
      },
    });

    return CommonMenuItems.appendCommonTail(items, this.app);
  }
}

class ViewMode extends BaseMode {
  private lastClickTime = 0;
  private doubleClickThreshold = 300; // ms

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
    this.app.events.on("frame-change", this.onFrameChange);
  }

  /**
   * Finish ViewMode - deactivate 3D scene helpers
   */
  public finish(): void {
    this.app.events.off("frame-change", this.onFrameChange);
    this.world.targetIndicator.hide();

    super.finish();
  }

  override async _on_pointer_down(pointerInfo: PointerInfo) {
    await super._on_pointer_down(pointerInfo);

    // Detect double-click
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    if (
      timeSinceLastClick < this.doubleClickThreshold &&
      pointerInfo.event.button === 0
    ) {
      // Left button only
      await this.handleDoubleClick();
    }

    this.lastClickTime = now;
  }

  /**
   * Handle double-click to set camera target (like Ovito)
   */
  private async handleDoubleClick(): Promise<void> {
    const hit = await this.pickHit();

    if (hit && (hit.type === "atom" || hit.type === "bond")) {
      let target: Vector3 | null = null;
      if (hit.metadata) {
        if (hit.type === "atom") {
          target = new Vector3(
            hit.metadata.position.x,
            hit.metadata.position.y,
            hit.metadata.position.z,
          );
        } else if (hit.type === "bond") {
          // Midpoint of bond from metadata
          const start = hit.metadata.start;
          const end = hit.metadata.end;
          target = new Vector3(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            (start.z + end.z) / 2,
          );
        }
      } else if (hit.mesh) {
        target = hit.mesh.absolutePosition.clone();
      }

      if (target) {
        // Only set camera target, don't move camera position (Ovito-like behavior)
        this.world.camera.setTarget(target);

        // Show target indicator at the picked point
        this.world.targetIndicator.show(target);
      }
    }
  }

  override async _on_pointer_up(pointerInfo: PointerInfo) {
    await super._on_pointer_up(pointerInfo);
  }

  override async _on_pointer_move(_pointerInfo: PointerInfo) {
    // ViewMode inherits atom info display functionality from BaseMode
    await super._on_pointer_move(_pointerInfo);
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
    const box = this.app.system.box;

    try {
      const { UpdateFrameCommand } = await import("../commands/frame");
      const updateCmd = new UpdateFrameCommand(this.app, { frame });
      const result = await updateCmd.do();

      if (result.success) {
        // If update succeeded, ensure box is also updated if needed.
        // For now, if box changed, UpdateFrame might not handle it.
        // We could call DrawBoxCommand here if box exists.
        if (box) {
          const { DrawBoxCommand } = await import("../commands/draw");
          const drawBox = new DrawBoxCommand(this.app, { box });
          drawBox.do();
        }
        return;
      }
      // console.log("UpdateFrame failed, falling back to DrawFrame:", result.reason);
    } catch (e) {
      // Ignore error and fall back
      // console.warn("UpdateFrameCommand error:", e);
    }

    // Fallback to full rebuild - clear scene first, then draw
    const { ClearSceneCommand } = await import("../commands/clear");
    const clearCmd = new ClearSceneCommand(this.app);
    clearCmd.do();

    const { DrawFrameCommand } = await import("../commands/draw");
    const cmd = new DrawFrameCommand(this.app, {
      frame,
      box,
    });
    await cmd.do();
  }
}

export { ViewMode };
