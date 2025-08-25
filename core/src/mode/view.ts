import { BaseMode, ModeType } from "./base";
import type { Molvis } from "@molvis/core";
import type { PointerInfo } from "@babylonjs/core";
import { Pane } from "tweakpane";
import { draw_frame } from "../artist/draw";
import { molecularPalette, type PaletteConfig } from "../artist/palette";

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

    // View Mode Section - Simple binding
    this.pane.addBinding(this.vm, "currentViewMode", {
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
    }).on("change", (ev) => {
      this.vm.currentViewMode = ev.value;
    });

    this.pane.addBlade({
      view: 'separator',
    });

    // Color Theme Section (collapsed by default)
    const themeFolder = this.pane.addFolder({ title: "Color Theme", expanded: false });
    
    const availableThemes = molecularPalette.getThemes();
    const themeOptions: { [key: string]: string } = {};
    availableThemes.forEach(theme => {
      const themeInfo = molecularPalette.getThemeInfo(theme);
      if (themeInfo) {
        themeOptions[themeInfo.name] = theme; // 反转：显示名称作为key，主题值作为value
      }
    });
    
    const themeConfig = { theme: "jmol" };
    themeFolder.addBinding(themeConfig, "theme", {
      view: "list",
      label: "Theme",
      options: themeOptions
    }).on("change", (ev) => {
      molecularPalette.configure({ theme: ev.value });
      // 更新调色盘配置，但不自动刷新显示
      // 用户需要手动重新绘制来看到新主题效果
      console.log(`Theme changed to: ${ev.value}`);
    });

    this.pane.addBlade({
      view: 'separator',
    });
    
    this.pane.addButton({ title: "Snapshot" }).on("click", () => {
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
      this.pane.hidden = false;
      
      // Force a repaint to ensure visibility
      this.container.offsetHeight;
    } else {
      // Container or pane not available
    }
  }

  public hide() {
    if (this.pane) {
      this.pane.hidden = true;
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
    // 暂时注释掉这个方法，因为viewportManager不存在
    // this.world.viewportManager.resetToSingleViewport();
    // this._redrawAllViewports();
  }

  private _redrawAllViewports(): void {
    // 暂时注释掉这个方法，因为viewportManager不存在
    // const viewports = this.world.viewportManager.getAllViewports();
    
    // 不再清除场景！让用户手动控制清除
    // this.world.clear();
    
    // Draw each viewport's frame
    // for (const viewport of viewports) {
    //   const frame = this.app.system.getFrame(viewport.frameIndex);
    //   if (frame) {
    //     // Set the camera for this viewport
    //     this.world.scene.activeCamera = viewport.camera;
        
    //     // Draw the frame with default options
    //     draw_frame(this.app, frame, { 
    //       atoms: {}, 
    //       bonds: {}, 
    //       clean: false 
    //     });
    //   }
    // }
    
    // Restore default camera
    // this.world.scene.activeCamera = this.world.camera;
  }

  // New method to get current frame atoms for molecule type detection
  public getCurrentFrameAtoms(): string[] {
    const currentFrameIndex = this.app.system.current_frame_index;
    const currentFrame = this.app.system.getFrame(currentFrameIndex);
    if (currentFrame) {
      return currentFrame.atoms.map(atom => atom.get("element") as string);
    }
    // Fallback to first frame if current frame not found
    const fallbackFrame = this.app.system.getFrame(0);
    if (fallbackFrame) {
      return fallbackFrame.atoms.map(atom => atom.get("element") as string);
    }
    return [];
  }

  // New method to refresh display after palette changes
  public refreshDisplay(): void {
    // Redraw current frame with updated palette
    const currentFrameIndex = this.app.system.current_frame_index;
    const currentFrame = this.app.system.getFrame(currentFrameIndex);
    if (currentFrame) {
      // 换主题时需要清空场景，然后重新绘制
      this.world.clear();
      draw_frame(this.app, currentFrame, { 
        atoms: {}, 
        bonds: {} 
      });
    } else {
      // Frame not found, fallback to frame 0
      const fallbackFrame = this.app.system.getFrame(0);
      if (fallbackFrame) {
        // 换主题时需要清空场景，然后重新绘制
        this.world.clear();
        draw_frame(this.app, fallbackFrame, { 
          atoms: {}, 
          bonds: {} 
        });
      }
    }
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
