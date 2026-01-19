import type { PointerInfo } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import type { Molvis } from "@molvis/core";

import { BaseMode, ModeType } from "./base";
import { ContextMenuController } from "../core/context_menu_controller";
import type { SelectionOp } from "../core/selection_manager";
import type { HitResult, MenuItem } from "./types";
import { CommonMenuItems } from "./menu_items";


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
      CommonMenuItems.clearSelection(this.app),
      CommonMenuItems.separator(),
      CommonMenuItems.snapshot(this.app)
    ];
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
    this.app.world.selectionManager.apply({ type: 'clear' });
    super.finish();
  }

  /**
   * Handle clicks to select/deselect atoms and bonds.
   * - Left-click: Select entity (clear previous selection if no Ctrl)
   * - Ctrl+Left-click: Toggle entity in selection (incremental)
   */
  override _on_pointer_pick(pointerInfo: PointerInfo): void {
    const isCtrl = pointerInfo.event.ctrlKey;

    const scenePick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      undefined,
      false,
      this.world.camera
    );

    // One-step resolution to encoded ID
    const encodedId = this.app.world.sceneIndex.resolvePickToId(
      scenePick.pickedMesh,
      scenePick.thinInstanceIndex
    );

    if (encodedId === null) {
      // Empty click
      if (!isCtrl) {
        this.app.world.selectionManager.apply({ type: 'clear' });
      }
      return;
    }

    // Determine type and generate SelectionOp
    const type = this.app.world.sceneIndex.getType(encodedId);
    if (!type) return;

    const op: SelectionOp = isCtrl
      ? { type: 'toggle', [type + 's']: [encodedId] }
      : { type: 'replace', [type + 's']: [encodedId] };

    this.app.world.selectionManager.apply(op);
  }

  // TODO: Reimplement copy/paste with new selection system
  /*
  override _on_press_ctrl_c(): void {
    const selected = this.selectionManager.getSelected();
    if (selected.length === 0) return;

    this.clipboard = this.serializeSelection(selected);
    console.log(`Copied ${selected.length} entities to clipboard (placeholder)`);
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

    console.log('Paste functionality deferred - requires implementation');
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

  private getWorldPositionFromScreen(): Vector3 | null {
    const pickResult = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      undefined,
      false,
      this.world.camera
    );
    return pickResult.pickedPoint || null;
  }
}

export { SelectMode };
