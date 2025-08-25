import type { Molvis } from "@molvis/core";
import type { GuiComponent } from "./types";
import { ModeIndicator } from "./components/mode-indicator";
import { ViewIndicator } from "./components/view-indicator";
import { InfoPanel } from "./components/info-panel";
import { FrameIndicator } from "./components/frame-indicator";
import { Logger } from "tslog";

const logger = new Logger({ name: "molvis-core" });

interface GuiOptions {
  showModeIndicator?: boolean;
  showViewIndicator?: boolean;
  showInfoPanel?: boolean;
  showFrameIndicator?: boolean;
}

class GuiManager {
  private _app: Molvis;
  private _components: Map<string, GuiComponent> = new Map();
  private _fullScreenUIContainer: HTMLElement;

  // Component instances
  private _modeIndicator!: ModeIndicator;
  private _viewIndicator!: ViewIndicator;
  private _infoPanel!: InfoPanel;
  private _frameIndicator!: FrameIndicator;

  constructor(app: Molvis, fullScreenUIContainer: HTMLElement, options: GuiOptions = {}) {
    this._app = app;
    this._fullScreenUIContainer = fullScreenUIContainer;
    this._initializeComponents(options);
    this._setupEventListeners();
    this._initializeDefaultStates();
  }

  private _initializeComponents(options: GuiOptions): void {
    
    // Create components with proper UI container
    this._modeIndicator = new ModeIndicator(this._fullScreenUIContainer);
    this._viewIndicator = new ViewIndicator(this._fullScreenUIContainer);
    this._infoPanel = new InfoPanel(this._fullScreenUIContainer);
    this._frameIndicator = new FrameIndicator(this._app, this._fullScreenUIContainer);

    // Register components
    this._components.set('mode', this._modeIndicator);
    this._components.set('view', this._viewIndicator);
    this._components.set('info', this._infoPanel);
    this._components.set('frame', this._frameIndicator);

    // Apply initial visibility based on options - 修复逻辑
    logger.info('[GuiManager] Setting component visibility...');
    if (options.showModeIndicator === true) {
      logger.info('[GuiManager] Showing mode indicator');
      this._modeIndicator.show();
    } else {
      logger.info('[GuiManager] Hiding mode indicator');
      this._modeIndicator.hide();
    }
    
    if (options.showViewIndicator === true) {
      logger.info('[GuiManager] Showing view indicator');
      this._viewIndicator.show();
    } else {
      logger.info('[GuiManager] Hiding view indicator');
      this._viewIndicator.hide();
    }
    
    if (options.showInfoPanel === true) {
      logger.info('[GuiManager] Showing info panel');
      this._infoPanel.show();
    } else {
      logger.info('[GuiManager] Hiding info panel');
      this._infoPanel.hide();
    }
    
    if (options.showFrameIndicator === true) {
      logger.info('[GuiManager] Showing frame indicator');
      this._frameIndicator.show();
    } else {
      logger.info('[GuiManager] Hiding frame indicator');
      this._frameIndicator.hide();
    }
  }

  private _setupEventListeners(): void {
    // Listen for mode changes - you'll need to implement these events in your app
    // this._app.on('modeChanged', (mode: string) => {
    //   this._modeIndicator.updateMode(mode);
    // });

    // Listen for view changes
    // this._app.on('viewChanged', (isOrthographic: boolean) => {
    //   this._viewIndicator.updateView(isOrthographic);
    // });

    // Listen for frame changes
    // this._app.on('frameChanged', (current: number, total: number) => {
    //   this._frameIndicator.updateFrame(current, total);
    // });
  }

  private _initializeDefaultStates(): void {
    // Initialize with actual current mode (with safety check)
    if (this._app.mode?.currentModeName) {
      const currentModeName = this._app.mode.currentModeName;
      this._modeIndicator.updateMode(currentModeName);
    } else {
      // Fallback to default mode
      this._modeIndicator.updateMode("edit");
    }
    
    // Initialize with actual current view mode (with safety check)
    try {
      if (this._app.world && typeof this._app.world.isOrthographic === 'function') {
        const isOrthographic = this._app.world.isOrthographic();
        this._viewIndicator.updateView(isOrthographic);
      } else {
        // Fallback to default view (perspective)
        this._viewIndicator.updateView(false);
      }
    } catch (error) {
      logger.warn('Failed to get orthographic state, using default:', error);
      this._viewIndicator.updateView(false);
    }
    
    // Initialize frame indicator with current state (with safety check)
    try {
      if (this._app.system) {
        this._frameIndicator.updateFrame(
          this._app.system.current_frame_index,
          this._app.system.n_frames
        );
      } else {
        this._frameIndicator.updateFrame(0, 0);
      }
    } catch (error) {
      logger.warn('Failed to get frame state, using default:', error);
      this._frameIndicator.updateFrame(0, 0);
    }
    
  }

  // Public API methods
  public updateMode(mode: string): void {
    this._modeIndicator.updateMode(mode);
  }

  public updateView(isOrthographic: boolean): void {
    this._viewIndicator.updateView(isOrthographic);
  }

  public updateInfoText(text: string): void {
    this._infoPanel.updateText(text);
  }

  public updateFrameIndicator(current: number, total: number): void {
    this._frameIndicator.updateFrame(current, total);
  }

  // Component management
  public getComponent<T extends GuiComponent>(name: string): T | undefined {
    return this._components.get(name) as T;
  }

  public showComponent(name: string): void {
    this._components.get(name)?.show();
  }

  public hideComponent(name: string): void {
    this._components.get(name)?.hide();
  }

  public dispose(): void {
    for (const component of this._components.values()) {
      component.dispose();
    }
    this._components.clear();
  }
}

export { GuiManager };
export type { GuiOptions };
