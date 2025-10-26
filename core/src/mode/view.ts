import { BaseMode, ModeType } from "./base";
import type { Molvis } from "../app";
import type { PointerInfo } from "@babylonjs/core";
import { Pane } from "tweakpane";

class ViewModeMenu {
  private container: HTMLDivElement | null = null;
  private pane: Pane | null = null;
  private containerId: string;
  private isBuilt: boolean;

  constructor(private vm: ViewMode) {
    this.containerId = "molvis-view-menu";
    this.isBuilt = false;
  }

  private build() {
    // Check if container already exists
    const existingContainer = this.vm.molvisApp.uiContainer?.querySelector(`#${this.containerId}`) as HTMLDivElement;

    if (existingContainer) {
      // Reuse existing container
      this.container = existingContainer;
      // Clean up existing Pane
      if (this.pane) {
        this.pane.dispose();
      }
    } else {
      // Create new menu container
      this.container = document.createElement("div");
      this.container.id = this.containerId;
      this.container.className = "MolvisModeMenu";
      this.container.style.position = "fixed"; // Use fixed positioning to avoid parent container influence
      this.container.style.zIndex = "99999"; // Very high z-index to ensure menu is on top
      this.container.style.pointerEvents = "auto"; // Ensure menu is clickable
      this.container.style.backgroundColor = "rgba(0, 0, 0, 0.8)"; // Add background for visibility
      this.container.style.borderRadius = "8px"; // Rounded corners
      this.container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)"; // Add shadow

      // Mount to app's uiContainer instead of document.body
      if (this.vm.molvisApp.uiContainer) {
        this.vm.molvisApp.uiContainer.appendChild(this.container);
      } else {
        // Fallback to body mount if uiContainer doesn't exist
        document.body.appendChild(this.container);
      }
    }

    this.pane = new Pane({
      container: this.container,
      title: "View Mode",
      expanded: true // Ensure the pane is expanded by default
    });
    (this.pane as any).hidden = true;

    // Build menu content
    this.buildMenuContent();
    this.isBuilt = true;
  }

  private buildMenuContent() {
    if (!this.pane) return;

    // Clear existing menu items (typed as any to avoid Pane typing friction)
    const paneAny = this.pane as any;
    if (paneAny.children) {
      for (const c of paneAny.children) {
        paneAny.remove(c);
      }
    }

    // View Mode Section - Simple binding
    (this.pane as any).addBinding(this.vm, "currentViewMode", {
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
      this.vm.currentViewMode = ev.value as string;
    });

    (this.pane as any).addBlade({
      view: 'separator',
    });

    (this.pane as any).addButton({ title: "Snapshot" }).on("click", () => {
      this.vm.takeScreenShot();
    });
  }

  public show(x: number, y: number) {
    // Lazy build: only build when first shown
    if (!this.isBuilt) {
      this.build();
    }

    if (this.container && this.pane) {
      // Ensure container is visible and positioned correctly
      this.container.style.display = "block";
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
      this.container.style.visibility = "visible";

      // Show the pane
      (this.pane as any).hidden = false;

      // Force a repaint to ensure visibility
      this.container.offsetHeight;
    } else {
      // Container or pane not available
    }
  }

  public hide() {
    if (this.pane) {
      (this.pane as any).hidden = true;
    }
    if (this.container) {
      this.container.style.display = "none";
      this.container.style.visibility = "hidden";
    }
  }

  public dispose() {
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
    }
    // Don't remove container, keep it for reuse
    // if (this.container?.parentNode) {
    //   this.container.parentNode.removeChild(this.container);
    // }
    this.container = null;
    this.isBuilt = false;
  }
}

class ViewMode extends BaseMode {
  private menu: ViewModeMenu;
  private viewMode = "persp";

  constructor(app: Molvis) {
    super(ModeType.View, app);
    this.menu = new ViewModeMenu(this);
  }

  // Provide method for ViewModeMenu to access app
  public get molvisApp(): Molvis {
    return this.app;
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
    this.menu.show(x, y);
  }

  protected hideContextMenu(): void {
    this.menu.hide();
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
    this.menu.show(100, 100);
  }

  // Viewport manager not implemented yet

  public resetViewport(): void {
    // 暂时注释掉这个方法，因为viewportManager不存在
    // this.world.viewportManager.resetToSingleViewport();
    // this._redrawAllViewports();
  }

  // private _redrawAllViewports(): void {}

  public override finish(): void {
    // Clean up menu
    if (this.menu) {
      this.menu.dispose();
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
