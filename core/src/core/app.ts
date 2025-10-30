import { logger } from "../utils/logger";
import { GuiManager } from "../dom/gui";
import { World } from "./world";
import { ModeManager, ModeType } from "../mode";
import type { MolvisOptions, ResolvedMolvisOptions, MolvisDomContext } from "../dom/options";
import { resolveMolvisOptions } from "../dom/options";
import { Engine } from "@babylonjs/core";

export class MolvisApp {
  private _guiManager: GuiManager;
  private _world: World;
  private _options: ResolvedMolvisOptions;
  private _engine: Engine;
  private _isRunning = false;

  constructor(canvas: HTMLCanvasElement, options: MolvisOptions = {}, dom: MolvisDomContext = {}) {
    this._options = resolveMolvisOptions(options);
    this._guiManager = new GuiManager(this, canvas, options, dom);
    
    // Create engine
    this._engine = new Engine(this._guiManager.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      doNotHandleContextLost: true
    });

    // Create world with default scene
    this._world = new World(this._guiManager.canvas, this._engine, this);
    this._guiManager.updateTabIndicator('default', this._world.allSceneIds);
    this._guiManager.initializeDefaultStates();
  }

  get canvas(): HTMLCanvasElement {
    return this._guiManager.canvas;
  }

  get world() {
    return this._world;
  }

  get scene() {
    return this._world.scene;
  }

  get mode() {
    return this._world.mode;
  }

  get executor() {
    return this._world.executor;
  }

  public get artists() {
    return this._world.artists;
  }

  get gui() {
    return this._guiManager;
  }

  get rootContainer(): HTMLElement {
    return this._guiManager.rootContainer;
  }

  get uiContainer(): HTMLElement {
    return this._guiManager.uiContainer;
  }

  get mountPoint(): HTMLElement {
    return this._guiManager.mountPoint;
  }

  get options(): ResolvedMolvisOptions {
    return this._options;
  }

  get displaySize(): { width: number; height: number } {
    return this._guiManager.displaySize;
  }

  get renderResolution(): { width: number; height: number } {
    return this._guiManager.renderResolution;
  }

  get pixelRatio(): number {
    return this._guiManager.pixelRatio;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  public execute(method: string, params: unknown = {}): unknown {
    try {
      return this._world.executor.execute(method, params);
    } catch (error) {
      logger.error("Method execution failed:", { method, params, error });
      throw error;
    }
  }

  public start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    if (this._world.allSceneIds.length > 1) {
      this._world.renderAll();
    } else {
      this._world.render();
    }
    logger.info("Molvis started successfully");
  }

  public stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    if (this._world.allSceneIds.length > 1) {
      this._world.stopAll();
    } else {
      this._world.stop();
    }
    logger.info("Molvis stopped successfully");
  }

  public resize = (): void => {
    this._world.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._guiManager.setSize(displayWidth, displayHeight);
    this._world.resize();
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._guiManager.setRenderResolution(renderWidth, renderHeight);
    this._world.resize();
  }

  public enableFitContainer(enabled: boolean): void {
    this._guiManager.enableFitContainer(enabled);
    this._world.resize();
  }

  public destroy(): void {
    // TODO: cleanup
    logger.info("Molvis destroyed and cleaned up");
  }

  public setMode(sceneId: string, mode: string): void {
    const modeManager = new ModeManager(this);
    switch (mode) {
      case "view":
        modeManager.switch_mode(ModeType.View);
        break;
      // Add other modes as needed
      default:
        // Unknown mode
        break;
    }
    this._world.setMode(sceneId, modeManager);
  }
}