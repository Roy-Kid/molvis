import { Engine } from "@babylonjs/core";
import { type CommandRegistry, commands } from "../commands";
import type { DrawFrameOption } from "../commands/draw";
import { ArrayFrameSource } from "../commands/sources";
import { CommandManager } from "../commands/manager";
import { EventEmitter, type MolvisEventMap } from "../events";
import { ModeManager, ModeType } from "../mode";
import { ModifierPipeline, PipelineEvents } from "../pipeline";
import type { FrameSource } from "../pipeline/pipeline";
import { GUIManager } from "../ui/manager";
import { logger } from "../utils/logger";
import { Artist } from "./artist";
import { type MolvisConfig, defaultMolvisConfig } from "./config";
import { type MolvisSetting, Settings } from "./settings";
import { StyleManager } from "./style";
import type { Theme } from "./style/theme";
import { System } from "./system";
import type { Trajectory } from "./system/trajectory";
import { World } from "./world";

import type { Box, Frame } from "@molcrafts/molrs";
import {
  MolvisButton,
  MolvisFolder,
  MolvisSeparator,
  MolvisSlider,
} from "../ui/components";
import { MolvisContextMenu } from "../ui/menus/context_menu";

export class MolvisApp {
  // DOM elements
  private _container: HTMLElement;
  private _root: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _uiOverlay: HTMLElement;

  // Core components
  private _config: MolvisConfig;
  private _engine: Engine;
  private _world: World;
  private _system: System;
  private _modeManager!: ModeManager;
  private _guiManager!: GUIManager;
  private _isRunning = false;

  // Pipelines
  private _modifierPipeline: ModifierPipeline;
  private _currentFrame = 0;

  // Style System
  private _styleManager: StyleManager;

  // Command registry (Registry/RPC)
  readonly commands: CommandRegistry;

  // Command Manager (History/Undo/Redo)
  public readonly commandManager: CommandManager;

  // Artist (high-level drawing API)
  public readonly artist: Artist;

  // Events
  public readonly events = new EventEmitter<MolvisEventMap>();

  // User settings (public API)
  public readonly settings: Settings;

  constructor(
    container: HTMLElement,
    config: MolvisConfig = {},
    setting?: Partial<MolvisSetting>,
  ) {
    this._config = defaultMolvisConfig(config);
    this._container = container;

    // Register Web Components
    this.registerWebComponents();

    // Create DOM structure
    this._root = this._createRoot();
    this._canvas = this._createCanvas();
    this._uiOverlay = this._createUIOverlay();

    // Assemble DOM (order is critical!)
    this._root.appendChild(this._canvas);
    this._root.appendChild(this._uiOverlay);
    this._container.appendChild(this._root);

    // Initialize Babylon engine
    this._engine = new Engine(
      this._canvas,
      this._config.canvas?.antialias ?? true,
      {
        preserveDrawingBuffer:
          this._config.canvas?.preserveDrawingBuffer ?? true,
        stencil: this._config.canvas?.stencil ?? true,
        alpha: this._config.canvas?.alpha ?? false,
      },
    );

    // Initialize World
    this._world = new World(this._canvas, this._engine, this);

    // Initialize Style Manager (before ModeManager)
    this._styleManager = new StyleManager(this._world.scene);

    // Initialize settings
    this.settings = new Settings(this, setting);

    // Initialize System
    this._system = new System(this.events);

    // Initialize GUI
    this._guiManager = new GUIManager(this._container, this, this._config);
    this._guiManager.mount();

    // Initialize default mode (View mode)
    this._modeManager = new ModeManager(this);
    this._modeManager.switch_mode(ModeType.View);
    this._world.setMode(this._modeManager);

    // Initialize modifier pipeline
    this._modifierPipeline = new ModifierPipeline();

    // Initialize Artist (Drawing Logic)
    this.artist = new Artist({ app: this });

    // Initialize command registry (use shared singleton)
    this.commands = commands;

    // Initialize Command Manager
    this.commandManager = new CommandManager(this);

    // Sync pipeline selection output to SelectionManager
    this._modifierPipeline.on(PipelineEvents.COMPUTED, ({ context }) => {
      const mask = context.currentSelection;
      if (!mask) return;

      const keys: string[] = [];
      for (const idx of mask.getIndices()) {
        const key = this._world.sceneIndex.getSelectionKeyForAtom(idx);
        if (key) keys.push(key);
      }
      this._world.selectionManager.apply({ type: 'replace', atoms: keys });
    });
  }

  /**
   * Register all web components for context menus
   */
  private registerWebComponents(): void {
    // Register custom elements
    if (!customElements.get("molvis-context-menu")) {
      customElements.define("molvis-context-menu", MolvisContextMenu);
    }
    if (!customElements.get("molvis-button")) {
      customElements.define("molvis-button", MolvisButton);
    }
    if (!customElements.get("molvis-separator")) {
      customElements.define("molvis-separator", MolvisSeparator);
    }
    if (!customElements.get("molvis-folder")) {
      customElements.define("molvis-folder", MolvisFolder);
    }
    if (!customElements.get("molvis-slider")) {
      customElements.define("molvis-slider", MolvisSlider);
    }
  }

  private _createRoot(): HTMLElement {
    const root = document.createElement("div");
    root.className = "molvis-root";

    // Fill parent container completely (no scrollbars, no white edges)
    root.style.position = "relative";
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.overflow = "hidden";
    root.style.margin = "0";
    root.style.padding = "0";

    return root;
  }

  private _createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.className = "molvis-canvas";

    // Canvas fills the root container
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.outline = "none";
    canvas.style.touchAction = "none";

    // Prevent default scrolling when zooming
    canvas.addEventListener(
      "wheel",
      (evt) => {
        evt.preventDefault();
      },
      { passive: false },
    );

    // Set initial canvas resolution based on container size
    const pixelRatio = window.devicePixelRatio || 1;
    const width = this._container.clientWidth || 800;
    const height = this._container.clientHeight || 600;

    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);

    return canvas;
  }

  private _createUIOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "molvis-ui-overlay";

    // Absolute positioned to cover canvas
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";

    if (this._config.showUI === false) {
      overlay.style.display = "none";
    }

    return overlay;
  }

  // Getters
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get world(): World {
    return this._world;
  }

  get scene() {
    return this._world.scene;
  }

  get mode() {
    return this._world.mode;
  }

  get modifierPipeline(): ModifierPipeline {
    return this._modifierPipeline;
  }

  get styleManager(): StyleManager {
    return this._styleManager;
  }

  get gui(): GUIManager {
    return this._guiManager;
  }

  get rootContainer(): HTMLElement {
    return this._root;
  }

  get uiContainer(): HTMLElement {
    return this._uiOverlay;
  }

  get mountPoint(): HTMLElement {
    return this._container;
  }

  get config(): MolvisConfig {
    return this._config;
  }

  get displaySize(): { width: number; height: number } {
    const rect = this._root.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  get renderResolution(): { width: number; height: number } {
    return { width: this._canvas.width, height: this._canvas.height };
  }

  get pixelRatio(): number {
    const size = this.displaySize;
    if (size.width === 0) return 1;
    return this._canvas.width / size.width;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  set currentFrame(value: number) {
    this._currentFrame = value;
  }

  get frame(): Frame | null {
    return this._system.frame;
  }

  set frame(value: Frame | null) {
    this._system.frame = value;
  }

  get system(): System {
    return this._system;
  }

  // Public methods
  /**
   * Execute a command by name.
   * @param name Command name
   * @param args Command arguments
   * @returns Promise if command is async, void otherwise
   */
  public execute<A, R = unknown>(name: string, args: A): R | Promise<R> {
    return this.commands.execute(name, this, args);
  }

  public start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._world.start();
    logger.info("Molvis started successfully");
  }

  public stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this._world.stop();
    logger.info("Molvis stopped successfully");
  }

  public resize = (): void => {
    // Let Babylon's engine.resize() read the canvas CSS size and update the
    // drawing-buffer dimensions internally.  Manually setting canvas.width /
    // canvas.height *before* the engine does it clears the bitmap and causes a
    // visible flash during continuous resize (e.g. dragging a splitter).
    this._world.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._root.style.width = `${displayWidth}px`;
    this._root.style.height = `${displayHeight}px`;
    this.resize();
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._canvas.width = renderWidth;
    this._canvas.height = renderHeight;
    this._world.resize();
  }

  public enableFitContainer(enabled: boolean): void {
    if (enabled) {
      this._root.style.width = "100%";
      this._root.style.height = "100%";
    }
    this.resize();
  }

  public destroy(): void {
    this._guiManager.unmount();

    if (this._root.parentElement) {
      this._root.parentElement.removeChild(this._root);
    }

    logger.info("Molvis destroyed and cleaned up");
  }

  public setMode(mode: string): void {
    switch (mode) {
      case "view":
        this._modeManager.switch_mode(ModeType.View);
        break;
      case "select":
        this._modeManager.switch_mode(ModeType.Select);
        break;
      case "edit":
        this._modeManager.switch_mode(ModeType.Edit);
        break;
      case "measure":
        this._modeManager.switch_mode(ModeType.Measure);
        break;
      case "manipulate":
        this._modeManager.switch_mode(ModeType.Manipulate);
        break;
      default:
        logger.warn(`Unknown mode: ${mode}`);
        break;
    }
  }

  public setTheme(theme: Theme): void {
    this._styleManager.setTheme(theme);
    // Request redraw if frame is loaded
    if (this._system.frame) {
      this.renderFrame(this._system.frame);
    }
  }

  /**
   * Update configuration at runtime.
   * Merges with existing config and propagates changes.
   */
  public setConfig(newConfig: Partial<MolvisConfig>): void {
    this._config = defaultMolvisConfig({ ...this._config, ...newConfig });

    if (newConfig.showUI !== undefined) {
      this._uiOverlay.style.display = this._config.showUI ? "block" : "none";
    }
  }

  /**
   * Compute a frame using the modifier pipeline.
   * @param frameIndex Index of frame to compute
   * @param source Frame source
   * @returns Promise resolving to the computed frame
   */
  public async computeFrame(
    frameIndex: number,
    source?: FrameSource,
  ): Promise<Frame> {
    if (!source) {
      throw new Error("computeFrame requires a source");
    }
    logger.info(`App: computeFrame called with source ${source} index ${frameIndex}`);
    const frame = await this._modifierPipeline.compute(source, frameIndex, this);
    this._currentFrame = frameIndex;
    return frame;
  }

  /**
   * Render a frame using the draw_frame command.
   * @param frame Frame to render
   * @param options Drawing options
   */
  public renderFrame(frame: Frame, box?: Box, options?: DrawFrameOption): void {
    // Optimization: If we have a single-frame trajectory, update in place
    // This avoids full system reset which breaks UI state and causes flickering
    if (this._system.trajectory.length === 1) {
      this._system.updateCurrentFrame(frame, box);
    } else {
      this._system.setFrame(frame, box); // Store frame and box in System
    }
    const drawResult = this.execute("draw_frame", { frame, box, options });
    if (drawResult instanceof Promise) {
      void drawResult.catch((error) => {
        logger.error("draw_frame failed", error);
      });
    }
  }


  /**
   * Load a new frame into the system, clearing the existing scene.
   * Consolidates scene clearing, history reset, and initial rendering.
   */
  public loadFrame(frame: Frame, box?: Box): void {
    this.artist.clear();
    this.commandManager.clearHistory();
    this._system.setFrame(frame, box);
    this.renderFrame(frame, box);
  }

  /**
   * Run the modifier pipeline on the current system frame and apply the result.
   * Use fullRebuild when the atom count or topology changes (e.g. file load).
   * Default is fast-path (visibility-only update, no flicker).
   */
  public async applyPipeline(options?: { fullRebuild?: boolean }): Promise<void> {
    const sourceFrame = this._system.frame;
    if (!sourceFrame) return;

    const source = new ArrayFrameSource([sourceFrame]);
    const computed = await this._modifierPipeline.compute(source, this._currentFrame, this);

    if (options?.fullRebuild) {
      this.renderFrame(computed);
    } else {
      this.artist.refreshFrame(computed);
    }
  }

  /**
   * Set the current trajectory and update the system.
   * Emits 'trajectory-change' event.
   */
  public setTrajectory(trajectory: Trajectory): void {
    this._system.trajectory = trajectory;
    this.events.emit("trajectory-change", trajectory);
    this.events.emit("frame-change", 0);
  }

  /**
   * Navigate to the next frame.
   */
  public nextFrame(): void {
    if (this._system.trajectory.next()) {
      this.events.emit("frame-change", this._system.trajectory.currentIndex);
    }
  }

  /**
   * Navigate to the previous frame.
   */
  public prevFrame(): void {
    if (this._system.trajectory.prev()) {
      this.events.emit("frame-change", this._system.trajectory.currentIndex);
    }
  }

  /**
   * Seek to a specific frame index.
   */
  public seekFrame(index: number): void {
    if (this._system.trajectory.seek(index)) {
      this.events.emit("frame-change", this._system.trajectory.currentIndex);
    }
  }
}
