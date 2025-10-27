import { Logger } from "tslog";
import { ModeManager } from "./mode";
import { World } from "./world";
import { Executor } from "./command";
import { GuiManager } from "./gui";
import { InstancedArtist, DynamicArtist } from "./artist";
import type { ArtistBase } from "./artist";

const logger = new Logger({ name: "molvis-core" });

export interface MolvisDisplayOptions {
  displayWidth?: number;
  displayHeight?: number;
  fitContainer?: boolean;
}

export interface MolvisRenderOptions {
  renderWidth?: number;
  renderHeight?: number;
  pixelRatio?: number;
  autoRenderResolution?: boolean;
}

export interface MolvisUIOptions {
  showUI?: boolean;
  uiComponents?: {
    showModeIndicator?: boolean;
    showViewIndicator?: boolean;
    showInfoPanel?: boolean;
    showFrameIndicator?: boolean;
  };
}

export interface MolvisGridOptions {
  enabled?: boolean;
  mainColor?: string;
  lineColor?: string;
  opacity?: number;
  majorUnitFrequency?: number;
  minorUnitVisibility?: number;
  size?: number;
}

export interface MolvisOptions extends MolvisDisplayOptions, MolvisRenderOptions, MolvisUIOptions {
  grid?: MolvisGridOptions;
}

export type ResolvedMolvisOptions = {
  displayWidth: number;
  displayHeight: number;
  fitContainer: boolean;
  renderWidth?: number;
  renderHeight?: number;
  pixelRatio: number;
  autoRenderResolution: boolean;
  showUI: boolean;
  uiComponents: {
    showModeIndicator: boolean;
    showViewIndicator: boolean;
    showInfoPanel: boolean;
    showFrameIndicator: boolean;
  };
  grid?: MolvisGridOptions;
};

const DEFAULT_UI_COMPONENTS = {
  showModeIndicator: true,
  showViewIndicator: true,
  showInfoPanel: true,
  showFrameIndicator: true,
};

const DEFAULT_PIXEL_RATIO =
  typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
    ? window.devicePixelRatio || 1
    : 1;

export const resolveMolvisOptions = (options: MolvisOptions = {}): ResolvedMolvisOptions => {
  const pixelRatio = options.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  return {
    displayWidth: options.displayWidth ?? 800,
    displayHeight: options.displayHeight ?? 600,
    fitContainer: options.fitContainer ?? false,
    renderWidth: options.renderWidth,
    renderHeight: options.renderHeight,
    pixelRatio,
    autoRenderResolution: options.autoRenderResolution ?? true,
    showUI: options.showUI ?? true,
    uiComponents: {
      showModeIndicator: options.uiComponents?.showModeIndicator ?? DEFAULT_UI_COMPONENTS.showModeIndicator,
      showViewIndicator: options.uiComponents?.showViewIndicator ?? DEFAULT_UI_COMPONENTS.showViewIndicator,
      showInfoPanel: options.uiComponents?.showInfoPanel ?? DEFAULT_UI_COMPONENTS.showInfoPanel,
      showFrameIndicator: options.uiComponents?.showFrameIndicator ?? DEFAULT_UI_COMPONENTS.showFrameIndicator,
    },
    grid: options.grid,
  };
};

export interface MolvisDomContext {
  mountPoint?: HTMLElement;
  rootContainer?: HTMLElement;
  uiContainer?: HTMLElement;
  ownsRootContainer?: boolean;
  ownsUiContainer?: boolean;
}

export interface MolvisDomElements {
  mountPoint: HTMLElement;
  rootContainer: HTMLElement;
  canvas: HTMLCanvasElement;
  uiContainer: HTMLElement;
}

export interface MolvisDomSetup extends MolvisDomElements {
  options: ResolvedMolvisOptions;
  context: MolvisDomContext;
}

const applyRootContainerStyles = (element: HTMLElement, options: ResolvedMolvisOptions): void => {
  element.className = element.className || "molvis-root";
  element.style.position = element.style.position || "relative";
  element.style.width = options.fitContainer ? "100%" : `${options.displayWidth}px`;
  element.style.height = options.fitContainer ? "100%" : `${options.displayHeight}px`;
  element.style.overflow = element.style.overflow || "hidden";
};

const computeRenderResolution = (
  options: ResolvedMolvisOptions,
  mountPoint: HTMLElement,
): { width: number; height: number } => {
  let width = options.renderWidth;
  let height = options.renderHeight;

  if (options.autoRenderResolution) {
    const actualDisplayWidth = options.fitContainer
      ? mountPoint.clientWidth || options.displayWidth
      : options.displayWidth;
    const actualDisplayHeight = options.fitContainer
      ? mountPoint.clientHeight || options.displayHeight
      : options.displayHeight;
    width = Math.floor(actualDisplayWidth * options.pixelRatio);
    height = Math.floor(actualDisplayHeight * options.pixelRatio);
  }

  return {
    width: width ?? options.displayWidth,
    height: height ?? options.displayHeight,
  };
};

const applyCanvasDefaults = (
  canvas: HTMLCanvasElement,
  options: ResolvedMolvisOptions,
  mountPoint: HTMLElement,
): void => {
  if (!canvas.classList.contains("molvis-canvas")) {
    canvas.classList.add("molvis-canvas");
  }

  const resolution = computeRenderResolution(options, mountPoint);
  canvas.width = resolution.width;
  canvas.height = resolution.height;

  const style = canvas.style;
  style.position = style.position || "absolute";
  style.top = style.top || "0";
  style.left = style.left || "0";
  style.width = style.width || "100%";
  style.height = style.height || "100%";
  style.touchAction = style.touchAction || "none";
  style.pointerEvents = style.pointerEvents || "auto";
};

const createUiContainer = (showUI: boolean): HTMLElement => {
  const container = document.createElement("div");
  container.className = "molvis-ui";
  container.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;

  if (!showUI) {
    container.style.display = "none";
  }

  return container;
};

export function createMolvisDom(mountPoint: HTMLElement, options: MolvisOptions = {}): MolvisDomSetup {
  const resolved = resolveMolvisOptions(options);

  const rootContainer = document.createElement("div");
  applyRootContainerStyles(rootContainer, resolved);

  const canvas = document.createElement("canvas");
  applyCanvasDefaults(canvas, resolved, mountPoint);
  rootContainer.appendChild(canvas);

  const uiContainer = createUiContainer(resolved.showUI);
  if (resolved.showUI) {
    rootContainer.appendChild(uiContainer);
  }

  mountPoint.appendChild(rootContainer);

  return {
    mountPoint,
    rootContainer,
    canvas,
    uiContainer,
    options: resolved,
    context: {
      mountPoint,
      rootContainer,
      uiContainer,
      ownsRootContainer: true,
      ownsUiContainer: true,
    },
  };
}

class Molvis {
  private _mountPoint?: HTMLElement;
  private _rootContainer?: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _uiContainer: HTMLElement;
  private _world!: World;
  private _mode!: ModeManager;
  private _executor!: Executor;
  private _gui!: GuiManager;
  private _options: ResolvedMolvisOptions;
  private readonly _artists = new Map<string, ArtistBase>();
  private _ownsRootContainer: boolean;
  private _ownsUiContainer: boolean;
  public gridManager: unknown;

  constructor(canvas: HTMLCanvasElement, options: MolvisOptions = {}, dom: MolvisDomContext = {}) {
    this._canvas = canvas;
    this._options = resolveMolvisOptions(options);

    this._rootContainer = dom.rootContainer ?? (canvas.parentElement as HTMLElement | undefined);
    this._mountPoint = dom.mountPoint ?? this._rootContainer?.parentElement ?? undefined;
    this._ownsRootContainer = dom.ownsRootContainer ?? false;

    if (dom.uiContainer) {
      this._uiContainer = dom.uiContainer;
      this._ownsUiContainer = dom.ownsUiContainer ?? false;
      if (this._options.showUI && this._rootContainer && !this._rootContainer.contains(this._uiContainer)) {
        this._rootContainer.appendChild(this._uiContainer);
      }
    } else {
      this._uiContainer = createUiContainer(this._options.showUI);
      this._ownsUiContainer = true;
      if (this._options.showUI && this._rootContainer) {
        this._rootContainer.appendChild(this._uiContainer);
      }
    }

    this._applyCanvasSafetyDefaults();
    this._initializeComponents();
  }

  private _applyCanvasSafetyDefaults(): void {
    if (this._canvas.width === 0 || this._canvas.width === 300) {
      this._canvas.width = this._options.renderWidth ?? this._options.displayWidth;
    }
    if (this._canvas.height === 0 || this._canvas.height === 150) {
      this._canvas.height = this._options.renderHeight ?? this._options.displayHeight;
    }

    if (!this._canvas.style.touchAction) {
      this._canvas.style.touchAction = "none";
    }
    if (!this._canvas.style.pointerEvents) {
      this._canvas.style.pointerEvents = "auto";
    }
  }

  private _initializeComponents(): void {
    this._world = new World(this._canvas);
    this._gui = new GuiManager(this, this._uiContainer, this._options.uiComponents);
    this._mode = new ModeManager(this);
    this._executor = new Executor(this);
    this._initializeArtists();
  }

  private _initializeArtists(): void {
    const instancedArtist = new InstancedArtist(this._world.scene, "instanced");
    this._artists.set("instanced", instancedArtist);
    this._executor.registerArtist("instanced", instancedArtist);

    const dynamicArtist = new DynamicArtist(this._world.scene, "dynamic");
    this._artists.set("dynamic", dynamicArtist);
    this._executor.registerArtist("dynamic", dynamicArtist);

    void instancedArtist.init();
    void dynamicArtist.init();
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get world(): World {
    return this._world;
  }

  get scene() {
    return this._world.scene;
  }

  get mode(): ModeManager {
    return this._mode;
  }

  get executor(): Executor {
    return this._executor;
  }

  public get artists(): Map<string, ArtistBase> {
    return this._artists;
  }

  get gui(): GuiManager {
    return this._gui;
  }

  get rootContainer(): HTMLElement {
    return this._rootContainer ?? (this._canvas.parentElement as HTMLElement) ?? this._canvas;
  }

  get uiContainer(): HTMLElement {
    return this._uiContainer;
  }

  get mountPoint(): HTMLElement {
    return this._mountPoint ?? this.rootContainer;
  }

  get options(): MolvisOptions {
    return { ...this._options, uiComponents: { ...this._options.uiComponents } };
  }

  get displaySize(): { width: number; height: number } {
    const element = this._rootContainer ?? this._canvas;
    const rect = element.getBoundingClientRect();
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
    return this._world.isRunning;
  }

  public execute(method: string, params: unknown = {}): unknown {
    try {
      return this._executor.execute(method, params);
    } catch (error) {
      logger.error("Method execution failed:", { method, params, error });
      throw error;
    }
  }

  public start(): void {
    if (!this._world.isRunning) {
      this._world.render();
      logger.info("Molvis started successfully");
    }
  }

  public stop(): void {
    if (this._world.isRunning) {
      this._world.stop();
      logger.info("Molvis stopped successfully");
    }
  }

  public resize = (): void => {
    this._world.resize();
  };

  public setSize(displayWidth: number, displayHeight: number): void {
    this._options.displayWidth = displayWidth;
    this._options.displayHeight = displayHeight;
    this._options.fitContainer = false;

    if (this._rootContainer) {
      this._rootContainer.style.width = `${displayWidth}px`;
      this._rootContainer.style.height = `${displayHeight}px`;
    }

    if (this._options.autoRenderResolution) {
      const pixelRatio = this._options.pixelRatio;
      this._canvas.width = Math.floor(displayWidth * pixelRatio);
      this._canvas.height = Math.floor(displayHeight * pixelRatio);
    } else {
      this._canvas.width = this._options.renderWidth ?? displayWidth;
      this._canvas.height = this._options.renderHeight ?? displayHeight;
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

    if (!this._rootContainer) {
      return;
    }

    if (enabled) {
      this._rootContainer.style.width = "100%";
      this._rootContainer.style.height = "100%";

      if (this._options.autoRenderResolution) {
        const pixelRatio = this._options.pixelRatio;
        const width =
          this._mountPoint?.clientWidth ?? this._rootContainer.clientWidth ?? this._options.displayWidth;
        const height =
          this._mountPoint?.clientHeight ?? this._rootContainer.clientHeight ?? this._options.displayHeight;
        this._canvas.width = Math.floor(width * pixelRatio);
        this._canvas.height = Math.floor(height * pixelRatio);
      }
    } else {
      const displayWidth = this._options.displayWidth;
      const displayHeight = this._options.displayHeight;
      this._rootContainer.style.width = `${displayWidth}px`;
      this._rootContainer.style.height = `${displayHeight}px`;
    }

    this._world.resize();
  }

  public finalize = (): void => {};

  public destroy(): void {
    if (this._world) {
      this._world.stop();
    }

    this._gui?.dispose();

    if (this._ownsUiContainer && this._uiContainer.parentElement) {
      this._uiContainer.parentElement.removeChild(this._uiContainer);
    }

    if (this._ownsRootContainer && this._rootContainer && this._mountPoint?.contains(this._rootContainer)) {
      this._mountPoint.removeChild(this._rootContainer);
    }

    logger.info("Molvis destroyed and cleaned up");
  }
}

export function mountMolvis(mountPoint: HTMLElement, options: MolvisOptions = {}): Molvis {
  const setup = createMolvisDom(mountPoint, options);
  return new Molvis(setup.canvas, setup.options, setup.context);
}

export { Molvis };
