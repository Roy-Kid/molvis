import { type PointerInfo, Vector3 } from "@babylonjs/core";
import type { MolvisApp } from "../app";
import { ContextMenuController } from "../ui/menus/controller";
import { BaseMode, ModeType } from "./base";
import { CommonMenuItems } from "./menu_items";
import type { HitResult, MenuItem } from "./types";
import { UpdateFrameCommand } from "../commands/frame";
import { DrawBoxCommand, DrawFrameCommand } from "../commands/draw";
import { WrapPBCModifier } from "../modifiers/WrapPBCModifier";
import { logger } from "../utils/logger";

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

    // Enable/Disable PBC wrapping
    const pbcEnabled = this.mode.isPbcEnabled();
    items.push({
      type: "button",
      title: pbcEnabled ? "PBC On" : "PBC Off",
      action: () => {
        this.mode.setPbcEnabled(!pbcEnabled);
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

  public isPbcEnabled(): boolean {
    for (const modifier of this.getWrapPbcModifiers()) {
      if (modifier.enabled) {
        return true;
      }
    }
    return false;
  }

  public setPbcEnabled(enabled: boolean): void {
    const pipeline = this.app.modifierPipeline;
    const modifiers = this.getWrapPbcModifiers();

    if (enabled) {
      if (modifiers.length === 0) {
        pipeline.addModifier(new WrapPBCModifier(`wrap-pbc-${Date.now()}`));
      } else {
        for (const modifier of modifiers) {
          modifier.enabled = true;
        }
      }
    } else {
      for (const modifier of modifiers) {
        modifier.enabled = false;
      }
    }

    void this.app.applyPipeline({ fullRebuild: true });
  }

  private getWrapPbcModifiers(): WrapPBCModifier[] {
    return this.app.modifierPipeline
      .getModifiers()
      .filter(
        (modifier): modifier is WrapPBCModifier =>
          modifier instanceof WrapPBCModifier,
      );
  }

  /**
   * Start ViewMode - activate 3D scene helpers
   */
  public start(): void {
    super.start();

    // Invalidate highlights for mode switch (View uses thin instances)
    this.app.world.highlighter.invalidateAndRebuild();

    // Listen for frame changes (both trajectory and frame changes)
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

  /**
   * Handle frame change - stateless, always tries to update, falls back to redraw if needed
   */
  private onFrameChange = () => {
    this.renderFrame();
  };

  override _on_press_q(): void {
    this.app.prevFrame();
  }

  override _on_press_e(): void {
    this.app.nextFrame();
  }

  /**
   * Unified frame rendering logic:
   * 1. Try UpdateFrameCommand (fast, in-place buffer update)
   * 2. If topology mismatch, use DrawFrameCommand (full rebuild)
   */
  private async renderFrame() {
    const frame = this.app.system.frame;
    const box = this.app.system.box;
    const atomMesh = this.app.artist.atomMesh;

    // Check if we can use UpdateFrameCommand
    const canUpdate = this.canUpdateFrame(frame, atomMesh);

    if (canUpdate) {
      // Try fast update
      const updateCmd = new UpdateFrameCommand(this.app, { frame });
      const result = await updateCmd.do();

      if (result.success) {
        // Update box if needed
        if (box) {
          const drawBox = new DrawBoxCommand(this.app, { box });
          drawBox.do();
        }
        return;
      }

      // Update failed, fall through to redraw
      logger.warn(
        `UpdateFrameCommand failed: ${result.reason}, using DrawFrameCommand`,
      );
    }

    // Full redraw (topology changed or update failed)
    const drawCmd = new DrawFrameCommand(this.app, { frame, box });
    await drawCmd.do();
  }

  /**
   * Check if current frame can be updated in-place (same topology)
   */
  private canUpdateFrame(frame: any, atomMesh: any): boolean {
    if (!atomMesh) return false;

    const currentAtomCount = atomMesh.thinInstanceCount;
    if (currentAtomCount === 0) return false;

    const frameAtoms = frame.getBlock("atoms");
    if (!frameAtoms) return false;

    const newAtomCount = frameAtoms.nrows();
    if (currentAtomCount !== newAtomCount) return false;

    // Check bond count
    const bondMesh = this.app.artist.bondMesh;
    if (bondMesh) {
      const currentBondCount = bondMesh.thinInstanceCount;
      const frameBonds = frame.getBlock("bonds");
      const newBondCount = frameBonds ? frameBonds.nrows() : 0;
      if (currentBondCount !== newBondCount) return false;
    }

    return true;
  }
}

export { ViewMode };
