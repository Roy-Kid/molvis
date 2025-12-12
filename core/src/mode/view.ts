import { BaseMode, ModeType } from "./base";
import type { MolvisApp } from "../core/app";
import type { PointerInfo } from "@babylonjs/core";
import { ContextMenuController } from "../core/context_menu_controller";
import type { HitResult, MenuItem } from "./types";

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

    // Snapshot button
    items.push({
      type: "button",
      title: "Snapshot",
      action: () => {
        this.mode.takeScreenShot();
      }
    });

    items.push({ type: "separator" });

    // View mode selector
    items.push({
      type: "binding",
      bindingConfig: {
        view: "list",
        label: "View Mode",
        options: [
          { text: "Perspective", value: "persp" },
          { text: "Orthographic", value: "ortho" },
          { text: "Front", value: "front" },
          { text: "Back", value: "back" },
          { text: "Left", value: "left" },
          { text: "Right", value: "right" },
        ],
        value: this.mode.currentViewMode,
      },
      action: (ev: any) => {
        this.mode.currentViewMode = ev.value as string;
      }
    });

    return items;
  }
}

class ViewMode extends BaseMode {
  private viewMode = "persp";

  constructor(app: MolvisApp) {
    super(ModeType.View, app);
  }

  protected createContextMenuController(): ContextMenuController {
    return new ViewModeContextMenu(this.app, this);
  }

  get currentViewMode(): string {
    return this.viewMode;
  }

  set currentViewMode(value: string) {
    this.viewMode = value;
    switch (value) {
      case "persp":
        this.setPerspective();
        break;
      case "ortho":
        this.setOrthographic();
        break;
      case "front":
        this.viewFront();
        break;
      case "back":
        this.viewBack();
        break;
      case "left":
        this.viewLeft();
        break;
      case "right":
        this.viewRight();
        break;
      default:
        // Unknown view mode
        break;
    }
  }

  public setPerspective(): void {
    this.world.setPerspective();
    if (this.gui) {
      this.gui.updateView(false); // false = persp
    }
  }

  public setOrthographic(): void {
    this.world.setOrthographic();
    if (this.gui) {
      this.gui.updateView(true); // true = orthographic
    }
  }

  public viewFront(): void {
    this.world.viewFront();
  }

  public viewBack(): void {
    this.world.viewBack();
  }

  public viewLeft(): void {
    this.world.viewLeft();
  }

  public viewRight(): void {
    this.world.viewRight();
  }

  public takeScreenShot(): void {
    this.world.takeScreenShot();
  }

  public override finish(): void {
    super.finish();
  }

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);
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
