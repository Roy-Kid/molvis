import type { PointerInfo } from "@babylonjs/core";

import type { Molvis } from "@molvis/core";

import type { SelectionOp } from "../core/selection_manager";
import { makeSelectionKey } from "../core/selection_manager";
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

    if (isCtrl) {
      op = { type: "toggle", [`${meta.type}s`]: [key] };
    } else {
      if (isSelected) {
        // If already selected, deselect it (remove)
        op = { type: "remove", [`${meta.type}s`]: [key] };
      } else {
        // If not selected, standard replace
        op = { type: "replace", [`${meta.type}s`]: [key] };
      }
    }

    this.app.world.selectionManager.apply(op);
  }

  /**
   * Selection happens on Up, but logic here is typically empty or handled by BaseMode
   * if we want click behavior. BaseMode handles click -> pick -> _on_pointer_pick
   */
  override _on_pointer_pick(_pointerInfo: PointerInfo): void {}

  // TODO: Reimplement copy/paste with new selection system
  /*
  override _on_press_ctrl_c(): void {
    const selected = this.selectionManager.getSelected();
    if (selected.length === 0) return;

    this.clipboard = this.serializeSelection(selected);
  }

  override _on_press_ctrl_v(): void {
    if (!this.clipboard) return;

    const pastePosition = this.getWorldPositionFromScreen();
    if (!pastePosition) return;

    const pasteCommand = new PasteSelectionCommand(this.app, {
      clipboardData: this.clipboard,
      pastePosition
    });
    pasteCommand.do();
  }

  private serializeSelection(selected: SelectedEntity[]): ClipboardData {
    const atoms = selected.filter(e => e.type === 'atom');

    const atomData = atoms.map((entity) => {
      const mesh = this.scene.getMeshById(entity.meshId);
      const element = mesh?.metadata?.element || 'C';

      return {
        element,
        relativePosition: Vector3.Zero()
      };
    });

    const bondData: Array<{ i: number; j: number; order: number }> = [];

    return {
      atoms: atomData,
      bonds: bondData
    };
  }
  */
}

export { SelectMode };
