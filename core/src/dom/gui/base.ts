import type { Molvis } from "@molvis/core";
import type { GuiComponent } from "./types";
import { ModeIndicator } from "./components/mode-indicator";
import { ViewIndicator } from "./components/view-indicator";
import { InfoPanel } from "./components/info-panel";
import { FrameIndicator } from "./components/frame-indicator";
import { TabIndicator } from "./components/tab-indicator";
import { Logger } from "tslog";
import { DomManager } from "../dom-manager";
import type { MolvisOptions, MolvisDomContext } from "../options";
import { resolveMolvisOptions } from "../options";

const logger = new Logger({ name: "molvis-core" });

interface GuiOptions {
  showModeIndicator?: boolean;
  showViewIndicator?: boolean;
  showInfoPanel?: boolean;
  showFrameIndicator?: boolean;
  showTabIndicator?: boolean;
}

class GuiManager extends DomManager {
  private _app: Molvis;
  private _components: Map<string, GuiComponent> = new Map();

  // Component instances
  private _modeIndicator!: ModeIndicator;
  private _viewIndicator!: ViewIndicator;
  private _infoPanel!: InfoPanel;
  private _frameIndicator!: FrameIndicator;
  private _tabIndicator!: TabIndicator;

  constructor(app: Molvis, canvas: HTMLCanvasElement, options: MolvisOptions = {}, dom: MolvisDomContext = {}) {
    const resolvedOptions = resolveMolvisOptions(options);
    super(canvas, resolvedOptions, dom);
    this._app = app;
    this._initializeComponents(options.uiComponents || {});
    this._setupEventListeners();
    // _initializeDefaultStates is called later after lifecycle is set up
  }

  private _initializeComponents(options: GuiOptions): void {
    
    // Create layers for each component
    const modeLayer = this.createLayer('mode-indicator', { position: 'absolute', top: '10px', left: '10px', zIndex: '10' });
    this._modeIndicator = new ModeIndicator(modeLayer);

    const viewLayer = this.createLayer('view-indicator', { position: 'absolute', top: '10px', right: '10px', zIndex: '10' });
    this._viewIndicator = new ViewIndicator(viewLayer);

    const infoLayer = this.createLayer('info-panel', { position: 'absolute', bottom: '10px', left: '10px', zIndex: '10' });
    this._infoPanel = new InfoPanel(infoLayer);

    const frameLayer = this.createLayer('frame-indicator', { position: 'absolute', bottom: '10px', right: '10px', zIndex: '10' });
    this._frameIndicator = new FrameIndicator(this._app, frameLayer);

    const tabLayer = this.createLayer('tab-indicator', { position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: '10' });
    this._tabIndicator = new TabIndicator(tabLayer);
    this._tabIndicator.setOnSceneChange((sceneId) => {
      // TODO: notify app to switch scene
    });

    // Register components
    this._components.set('mode', this._modeIndicator);
    this._components.set('view', this._viewIndicator);
    this._components.set('info', this._infoPanel);
    this._components.set('frame', this._frameIndicator);
    this._components.set('tab', this._tabIndicator);

    // Apply initial visibility based on options
    logger.info('[GuiManager] Setting component visibility...');
    if (options.showModeIndicator !== false) {
      logger.info('[GuiManager] Showing mode indicator');
      this.enableLayer('mode-indicator', true);
    } else {
      logger.info('[GuiManager] Hiding mode indicator');
      this.enableLayer('mode-indicator', false);
    }
    
    if (options.showViewIndicator !== false) {
      logger.info('[GuiManager] Showing view indicator');
      this.enableLayer('view-indicator', true);
    } else {
      logger.info('[GuiManager] Hiding view indicator');
      this.enableLayer('view-indicator', false);
    }
    
    if (options.showInfoPanel !== false) {
      logger.info('[GuiManager] Showing info panel');
      this.enableLayer('info-panel', true);
    } else {
      logger.info('[GuiManager] Hiding info panel');
      this.enableLayer('info-panel', false);
    }
    
    if (options.showFrameIndicator !== false) {
      logger.info('[GuiManager] Showing frame indicator');
      this.enableLayer('frame-indicator', true);
    } else {
      logger.info('[GuiManager] Hiding frame indicator');
      this.enableLayer('frame-indicator', false);
    }

    if (options.showTabIndicator !== false) {
      logger.info('[GuiManager] Showing tab indicator');
      this.enableLayer('tab-indicator', true);
    } else {
      logger.info('[GuiManager] Hiding tab indicator');
      this.enableLayer('tab-indicator', false);
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

  public initializeDefaultStates(): void {
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
      if ((this._app as any).system) {
        this._frameIndicator.updateFrame(
          (this._app as any).system.current_frame_index,
          (this._app as any).system.n_frames
        );
      } else {
        // Fallback to default frame state
        this._frameIndicator.updateFrame(0, 1);
      }
    } catch (error) {
      logger.warn('Failed to initialize frame indicator:', error);
      this._frameIndicator.updateFrame(0, 1);
    }

    // Initialize tab indicator
    this._tabIndicator.updateActiveScene('scene-1');
    
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

  public updateTabIndicator(sceneId: string, allSceneIds?: string[]): void {
    this._tabIndicator.updateActiveScene(sceneId, allSceneIds);
  }

  // Component management
  public getComponent<T extends GuiComponent>(name: string): T | undefined {
    return this._components.get(name) as T;
  }

  public showComponent(name: string): void {
    const layerId = this._getLayerId(name);
    if (layerId) {
      this.enableLayer(layerId, true);
    }
  }

  public hideComponent(name: string): void {
    const layerId = this._getLayerId(name);
    if (layerId) {
      this.enableLayer(layerId, false);
    }
  }

  private _getLayerId(name: string): string | undefined {
    switch (name) {
      case 'mode': return 'mode-indicator';
      case 'view': return 'view-indicator';
      case 'info': return 'info-panel';
      case 'frame': return 'frame-indicator';
      case 'tab': return 'tab-indicator';
      default: return undefined;
    }
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
