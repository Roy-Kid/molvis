import { BaseMode, ModeType } from "./base";
import type { Molvis } from "@molvis/core";
import type { PointerInfo } from "@babylonjs/core";
import { Pane } from "tweakpane";
import { draw_frame } from "../artist/draw";

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
      this.container.style.zIndex = "9999"; // High z-index to ensure menu is on top
      this.container.style.pointerEvents = "auto"; // Ensure menu is clickable
      
      // Mount to app's uiContainer instead of document.body
      if (this.vm.molvisApp.uiContainer) {
        this.vm.molvisApp.uiContainer.appendChild(this.container);
      } else {
        // Fallback to body mount if uiContainer doesn't exist
        document.body.appendChild(this.container);
      }
    }
    
    this.pane = new Pane({ container: this.container, title: "View Mode" });
    this.pane.hidden = true;

    // Build menu content
    this.buildMenuContent();
    this.isBuilt = true;
  }

  private buildMenuContent() {
    if (!this.pane) return;

    // Clear existing menu items
    for (const c of this.pane.children) {
      this.pane.remove(c);
    }

    this.pane.addBinding(this.vm, "currentViewMode", {
      view: "list",
      label: "view",
      options: {
        persp: "persp",
        ortho: "ortho", 
        front: "front",
        back: "back",
        left: "left",
        right: "right",
      },
      value: "persp"
    });
    this.pane.addBlade({
      view: 'separator',
    });
    
    // Add split viewport options
    const splitFolder = this.pane.addFolder({ title: "Split Viewport" });
    
    splitFolder.addButton({ title: "Split Horizontal" }).on("click", () => {
      this.vm.splitViewport("horizontal");
    });
    
    splitFolder.addButton({ title: "Split Vertical" }).on("click", () => {
      this.vm.splitViewport("vertical");
    });
    
    splitFolder.addButton({ title: "Split Quad" }).on("click", () => {
      this.vm.splitViewport("quad");
    });
    
    splitFolder.addButton({ title: "Reset Viewport" }).on("click", () => {
      this.vm.resetViewport();
    });
    
    this.pane.addBlade({
      view: 'separator',
    });
    this.pane.addButton({ title: "snapshot" }).on("click", () => {
      this.vm.takeScreenShot();
    });
  }

  public show(x: number, y: number) {
    // Lazy build: only build when first shown
    if (!this.isBuilt) {
      this.build();
    }
    
    if (this.container && this.pane) {
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
      this.pane.hidden = false;
    }
  }

  public hide() {
    if (this.pane) {
      this.pane.hidden = true;
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

  public splitViewport(mode: "horizontal" | "vertical" | "quad"): void {
    // Get current viewport ID (for now, we'll use "main" as default)
    const currentViewportId = "main";
    
    // Get available frame indices from trajectory
    const frameIndices: number[] = [];
    const nFrames = this.app.system.n_frames;
    
    // For now, use sequential frame indices
    // In the future, this could be configurable
    switch (mode) {
      case "horizontal":
      case "vertical":
        frameIndices.push(0, Math.min(1, nFrames - 1));
        break;
      case "quad":
        frameIndices.push(0, Math.min(1, nFrames - 1), Math.min(2, nFrames - 1), Math.min(3, nFrames - 1));
        break;
    }
    
    // Perform the split
    const newViewports = this.world.viewportManager.splitViewport(currentViewportId, mode, frameIndices);
    
    // Redraw all viewports with their respective frames
    this._redrawAllViewports();
  }

  public resetViewport(): void {
    this.world.viewportManager.resetToSingleViewport();
    this._redrawAllViewports();
  }

  private _redrawAllViewports(): void {
    const viewports = this.world.viewportManager.getAllViewports();
    
    // Clear the scene first
    this.world.clear();
    
    // Draw each viewport's frame
    for (const viewport of viewports) {
      const frame = this.app.system.getFrame(viewport.frameIndex);
      if (frame) {
        // Set the camera for this viewport
        this.world.scene.activeCamera = viewport.camera;
        
        // Draw the frame with default options
        draw_frame(this.app, frame, { 
          atoms: {}, 
          bonds: {}, 
          clean: false 
        });
      }
    }
    
    // Restore default camera
    this.world.scene.activeCamera = this.world.camera;
  }

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
