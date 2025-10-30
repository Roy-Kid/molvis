import { BaseMode, ModeType } from "./base";
import type { MolvisApp } from "../core/app";
import type { PointerInfo } from "@babylonjs/core";

class ViewMode extends BaseMode {
  private viewMode = "persp";

  constructor(app: MolvisApp) {
    super(ModeType.View, app);
  }

  protected getCustomMenuBuilder(): ((pane: any) => void) | undefined {
    return (pane: any) => {
      // View Mode Section - Simple binding
      pane.addBinding(this, "currentViewMode", {
        view: "list",
        label: "View Mode",
        options: {
          persp: "persp",
          ortho: "ortho",
          front: "front",
          back: "back",
          left: "left",
          right: "right",
        }
      }).on("change", (ev: any) => {
        this.currentViewMode = ev.value as string;
      });

      pane.addBlade({
        view: 'separator',
      });
    };
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

  protected showContextMenu(x: number, y: number): void {
    this.contextMenu.show(x, y);
  }

  protected hideContextMenu(): void {
    this.contextMenu.hide();
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

  // Debug method to test menu manually
  public testMenu(): void {
    this.contextMenu.show(100, 100);
  }

  public resetViewport(): void {
    // this.world.viewportManager.resetToSingleViewport();
    // this._redrawAllViewports();
  }

  // private _redrawAllViewports(): void {}

  public override finish(): void {
    // Clean up menu
    if (this.contextMenu) {
      this.contextMenu.dispose();
    }

    // Call parent finish method
    super.finish();
  }

  override _on_pointer_down(pointerInfo: PointerInfo) {
    super._on_pointer_down(pointerInfo);
    if (pointerInfo.event.button === 0) {
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
