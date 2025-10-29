import { logger } from "../utils/logger";
import { DomManager } from "../dom/dom-manager";
import { Lifecycle } from "./lifecycle";
import type { MolvisOptions, ResolvedMolvisOptions, MolvisDomContext } from "../dom/options";
import { resolveMolvisOptions } from "../dom/options";

export class MolvisApp {
  private _domManager: DomManager;
  private _lifecycle: Lifecycle;
  private _options: ResolvedMolvisOptions;

  constructor(canvas: HTMLCanvasElement, options: MolvisOptions = {}, dom: MolvisDomContext = {}) {
    this._options = resolveMolvisOptions(options);
    this._domManager = new DomManager(canvas, this._options, dom);
    this._lifecycle = new Lifecycle(this._domManager, this._options);
    this._lifecycle.init();
  }

  get canvas(): HTMLCanvasElement {
    return this._domManager.canvas;
  }

  get world() {
    return this._lifecycle.world;
  }

  get scene() {
    return this._lifecycle.scene;
  }

  get mode() {
    return this._lifecycle.mode;
  }

  get executor() {
    return this._lifecycle.executor;
  }

  public get artists() {
    return this._lifecycle.artists;
  }

  get gui() {
    return this._lifecycle.gui;
  }

  get rootContainer(): HTMLElement {
    return this._domManager.rootContainer;
  }

  get uiContainer(): HTMLElement {
    return this._domManager.uiContainer;
  }

  get mountPoint(): HTMLElement {
    return this._domManager.mountPoint;
  }

  get options(): MolvisOptions {
    return this._lifecycle.options;
  }

  get displaySize(): { width: number; height: number } {
    return this._domManager.displaySize;
  }

  get renderResolution(): { width: number; height: number } {
    return this._domManager.renderResolution;
  }

  get pixelRatio(): number {
    return this._domManager.pixelRatio;
  }

  get isRunning(): boolean {
    return this._lifecycle.isRunning;
  }

  public execute(method: string, params: unknown = {}): unknown {
    try {
      return this._lifecycle.executor.execute(method, params);
    } catch (error) {
      logger.error("Method execution failed:", { method, params, error });
      throw error;
    }
  }

  public start(): void {
    this._lifecycle.start();
    logger.info("Molvis started successfully");
  }

  public stop(): void {
    this._lifecycle.stop();
    logger.info("Molvis stopped successfully");
  }

  public resize = (): void => {
    this._lifecycle.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._domManager.setSize(displayWidth, displayHeight);
    this._lifecycle.resize();
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._domManager.setRenderResolution(renderWidth, renderHeight);
    this._lifecycle.resize();
  }

  public enableFitContainer(enabled: boolean): void {
    this._domManager.enableFitContainer(enabled);
    this._lifecycle.resize();
  }

  public finalize = (): void => {};

  public destroy(): void {
    this._lifecycle.destroy();
    logger.info("Molvis destroyed and cleaned up");
  }
}