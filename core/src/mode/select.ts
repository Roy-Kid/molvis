
import type { PointerInfo } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";

import { BaseMode, ModeType } from "./base";
import { ContextMenuController } from "../core/context_menu_controller";
import { SelectionManager } from "../core/selection_manager";
import type { HitResult, MenuItem } from "./types";

/**
 * Context menu controller for Select mode.
 */
class SelectModeContextMenu extends ContextMenuController {
  constructor(app: Molvis) {
    super(app, "molvis-select-menu");
  }

  protected shouldShowMenu(_hit: HitResult | null, isDragging: boolean): boolean {
    return !isDragging;
  }

  protected buildMenuItems(_hit: HitResult | null): MenuItem[] {
    return [
      {
        type: "button",
        title: "Snapshot",
        action: () => {
          this.app.world.takeScreenShot();
        }
      }
    ];
  }
}

/**
 * SelectMode with per-instance color-based highlighting.
 * Uses SelectionManager for state management and highlighting.
 */
class SelectMode extends BaseMode {
  private selectionManager: SelectionManager;

  constructor(app: Molvis) {
    super(ModeType.Select, app);
    this.selectionManager = new SelectionManager(this.scene);
  }

  protected createContextMenuController(): ContextMenuController {
    return new SelectModeContextMenu(this.app);
  }

  /**
   * Called when entering select mode - reapply highlights.
   */
  onEnter(): void {
    this.selectionManager.reapplyHighlights();
  }

  /**
   * Called when exiting select mode - clear all highlights.
   */
  override finish(): void {
    this.selectionManager.clearAll();
    super.finish();
  }

  /**
   * Handle atom clicks to toggle selection.
   */
  override _on_pointer_pick(_pointerInfo: PointerInfo): void {
    const pickResult = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      undefined,
      false,
      this.world.camera
    );

    const mesh = pickResult.hit ? pickResult.pickedMesh : null;
    if (!mesh?.metadata || mesh.metadata.meshType !== 'atom') return;

    const instanceIndex = pickResult.thinInstanceIndex;
    if (instanceIndex === undefined || instanceIndex === -1) return;

    this.selectionManager.toggle(mesh, instanceIndex);
  }
}

export { SelectMode };
