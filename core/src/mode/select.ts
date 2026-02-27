import type { PointerInfo } from "@babylonjs/core";

import type { MolvisApp as Molvis } from "../app";

import type { SelectionOp } from "../selection_manager";
import { makeSelectionKey } from "../selection_manager";
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
 * Uses SceneIndex for picking and SelectionManagerV2 for state management.
 */
class SelectMode extends BaseMode {
  constructor(app: Molvis) {
    super(ModeType.Select, app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new SelectModeContextMenu(this.app);
  }

  /**
   * Called when entering select mode
   */
  override start(): void {
    super.start();
    // Invalidate highlights for mode switch
    this.app.world.highlighter.invalidateAndRebuild();
  }

  /**
   * Called when exiting select mode
   */
  override finish(): void {
    this.app.world.selectionManager.apply({ type: "clear" });
    super.finish();
  }

  /**
   * Handle clicks to select/deselect atoms and bonds.
   * - Left-click: Select entity (clear previous selection if no Ctrl)
   * - Ctrl+Left-click: Toggle entity in selection (incremental)
   */
  override async _on_left_up(pointerInfo: PointerInfo): Promise<void> {
    const isCtrl = pointerInfo.event.ctrlKey;

    const hit = await this.pickHit();

    if (!hit || (hit.type !== "atom" && hit.type !== "bond")) {
      // Empty click
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

  /**
   * Selection happens on Up, but logic here is typically empty or handled by BaseMode
   * if we want click behavior. BaseMode handles click -> pick -> _on_pointer_pick
   */
  override _on_pointer_pick(_pointerInfo: PointerInfo): void {}
}

export { SelectMode };
