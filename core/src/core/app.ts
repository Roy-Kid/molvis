import { Engine } from "@babylonjs/core";
import { logger } from "../utils/logger";
import { GuiManager } from "./gui/manager";
import { World } from "./world";
import { ModeManager, ModeType } from "../mode";
import type { MolvisOptions, ResolvedMolvisOptions } from "./options";
import { resolveMolvisOptions } from "./options";
import { DataPipeline, RenderPipeline, CommandRegistry, commands } from "../commands";
import type { DataPipelineContext, RenderPipelineContext } from "../commands";
import type { Frame } from "../structure/frame";

export class MolvisApp {
  // DOM elements
  private _container: HTMLElement;
  private _root: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _uiOverlay: HTMLElement;

  // Core components
  private _options: ResolvedMolvisOptions;
  private _engine: Engine;
  private _world: World;
  private _gui: GuiManager;
  private _isRunning = false;
  
  // Pipelines
  private _dataPipeline: DataPipeline;
  private _renderPipeline: RenderPipeline;
  private _currentFrame: number = 0;
  
  // Command registry
  readonly commands: CommandRegistry;

  constructor(container: HTMLElement, options: MolvisOptions = {}) {
    this._options = resolveMolvisOptions(options);
    this._container = container;

    // Create DOM structure
    this._root = this._createRoot();
    this._canvas = this._createCanvas();
    this._uiOverlay = this._createUIOverlay();

    // Assemble DOM (order is critical!)
    this._root.appendChild(this._canvas);
    this._root.appendChild(this._uiOverlay);
    this._container.appendChild(this._root);

    // Initialize Babylon engine
    this._engine = new Engine(this._canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      doNotHandleContextLost: true
    });

    // Initialize World
    this._world = new World(this._canvas, this._engine, this);

    // Initialize GUI
    this._gui = new GuiManager(this, this._uiOverlay, this._options);
    this._gui.initializeDefaultStates();

    // Initialize default mode (Edit mode)
    const modeManager = new ModeManager(this);
    modeManager.switch_mode(ModeType.Edit);
    this._world.setMode(modeManager);

    // Initialize pipelines
    this._dataPipeline = new DataPipeline();
    this._renderPipeline = new RenderPipeline();
    this._renderPipeline.scene = this._world.scene;
    this._renderPipeline.world = this._world;
    
    // Initialize command registry (use shared singleton)
    this.commands = commands;
  }

  private _createRoot(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'molvis-root';
    const opts = this._options;

    // Simple: relative positioning, size from options or container
    root.style.position = 'relative';
    root.style.width = opts.fitContainer ? '100%' : `${opts.displayWidth}px`;
    root.style.height = opts.fitContainer ? '100%' : `${opts.displayHeight}px`;
    root.style.overflow = 'hidden';

    return root;
  }

  private _createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'molvis-canvas';

    // Simple: fill container
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Set canvas resolution
    const opts = this._options;
    const ratio = opts.pixelRatio;

    let width: number, height: number;
    if (opts.fitContainer) {
      width = this._container.clientWidth || opts.displayWidth;
      height = this._container.clientHeight || opts.displayHeight;
    } else {
      width = opts.displayWidth;
      height = opts.displayHeight;
    }

    if (opts.autoRenderResolution) {
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
    } else {
      canvas.width = opts.renderWidth ?? width;
      canvas.height = opts.renderHeight ?? height;
    }

    return canvas;
  }

  private _createUIOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'molvis-ui-overlay';

    // Absolute positioned to cover canvas
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

    if (!this._options.showUI) {
      overlay.style.display = 'none';
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


  // Removed artists getter - artists are now integrated into RenderOps

  get gui(): GuiManager {
    return this._gui;
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

  get options(): ResolvedMolvisOptions {
    return this._options;
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
    if (size.width === 0) {
      return this._options.pixelRatio;
    }
    return this._canvas.width / size.width;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get dataPipeline(): DataPipeline {
    return this._dataPipeline;
  }

  get renderPipeline(): RenderPipeline {
    return this._renderPipeline;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  set currentFrame(value: number) {
    this._currentFrame = value;
  }

  // Public methods
  /**
   * Execute a command by name.
   * @param name Command name
   * @param args Command arguments
   * @returns Promise if command is async, void otherwise
   */
  public execute<A>(name: string, args: A): void | Promise<void> {
    return this.commands.execute(name, this, args);
  }


  public start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._world.render();
    logger.info("Molvis started successfully");
  }

  public stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this._world.stop();
    logger.info("Molvis stopped successfully");
  }

  public resize = (): void => {
    // Update canvas resolution
    const opts = this._options;
    const ratio = opts.pixelRatio;

    let width: number, height: number;
    if (opts.fitContainer) {
      width = this._container.clientWidth || opts.displayWidth;
      height = this._container.clientHeight || opts.displayHeight;
    } else {
      width = opts.displayWidth;
      height = opts.displayHeight;
    }

    if (opts.autoRenderResolution) {
      this._canvas.width = Math.floor(width * ratio);
      this._canvas.height = Math.floor(height * ratio);
    }

    this._world.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._options.displayWidth = displayWidth;
    this._options.displayHeight = displayHeight;
    this._options.fitContainer = false;

    this._root.style.width = `${displayWidth}px`;
    this._root.style.height = `${displayHeight}px`;

    const ratio = this._options.pixelRatio;
    if (this._options.autoRenderResolution) {
      this._canvas.width = Math.floor(displayWidth * ratio);
      this._canvas.height = Math.floor(displayHeight * ratio);
    }

    this._world.resize();
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._options.renderWidth = renderWidth;
    this._options.renderHeight = renderHeight;
    this._options.autoRenderResolution = false;

    this._canvas.width = renderWidth;
    this._canvas.height = renderHeight;

    this._world.resize();
  }

  public enableFitContainer(enabled: boolean): void {
    this._options.fitContainer = enabled;

    if (enabled) {
      this._root.style.width = "100%";
      this._root.style.height = "100%";

      const ratio = this._options.pixelRatio;
      const width = this._container.clientWidth || this._options.displayWidth;
      const height = this._container.clientHeight || this._options.displayHeight;

      if (this._options.autoRenderResolution) {
        this._canvas.width = Math.floor(width * ratio);
        this._canvas.height = Math.floor(height * ratio);
      }
    } else {
      const width = this._options.displayWidth;
      const height = this._options.displayHeight;
      this._root.style.width = `${width}px`;
      this._root.style.height = `${height}px`;
    }

    this._world.resize();
  }

  public destroy(): void {
    this._gui.dispose();

    if (this._root.parentElement) {
      this._root.parentElement.removeChild(this._root);
    }

    logger.info("Molvis destroyed and cleaned up");
  }

  public setMode(mode: string): void {
    const modeManager = new ModeManager(this);
    switch (mode) {
      case "view":
        modeManager.switch_mode(ModeType.View);
        break;
      default:
        break;
    }
    this._world.setMode(modeManager);
  }

  /**
   * Compute a frame using the data pipeline.
   * @param frameIndex Index of frame to compute
   * @param ctx Pipeline context (optional, uses pipeline source if not provided)
   * @returns Promise resolving to the computed frame
   */
  public async computeFrame(
    frameIndex: number,
    ctx?: Partial<DataPipelineContext>
  ): Promise<Frame> {
    const pipelineCtx: DataPipelineContext = {
      source: ctx?.source || this._dataPipeline.source!,
    };
    
    if (!pipelineCtx.source) {
      throw new Error("No frame source available. Set dataPipeline.source or provide source in context.");
    }

    const frame = await this._dataPipeline.compute(frameIndex, pipelineCtx);
    this._currentFrame = frameIndex;
    return frame;
  }

  /**
   * Render a frame using the render pipeline.
   * @param frame Frame to render
   * @param ctx Pipeline context (optional, uses pipeline scene/world if not provided)
   */
  public renderFrame(
    frame: Frame,
    ctx?: Partial<RenderPipelineContext>
  ): void {
    const pipelineCtx: RenderPipelineContext = {
      scene: ctx?.scene || this._renderPipeline.scene!,
      world: ctx?.world || this._renderPipeline.world!,
    };

    if (!pipelineCtx.scene) {
      throw new Error("No scene available. Set renderPipeline.scene or provide scene in context.");
    }
    if (!pipelineCtx.world) {
      throw new Error("No world available. Set renderPipeline.world or provide world in context.");
    }

    this._renderPipeline.render(frame, pipelineCtx);
  }
}