import type { MolvisOptions, ResolvedMolvisOptions, MolvisDomContext, MolvisDomSetup } from "./options";
import { resolveMolvisOptions } from "./options";
import { ResolutionManager } from "./resolution";

const applyRootContainerStyles = (element: HTMLElement, options: ResolvedMolvisOptions): void => {
  element.className = element.className || "molvis-root";
  element.style.position = element.style.position || "relative";
  element.style.width = options.fitContainer ? "100%" : `${options.displayWidth}px`;
  element.style.height = options.fitContainer ? "100%" : `${options.displayHeight}px`;
  element.style.overflow = element.style.overflow || "hidden";
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
  const resolutionManager = new ResolutionManager(resolved, mountPoint, canvas);
  resolutionManager.applyCanvasDefaults();
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

export class DomManager {
  private _mountPoint: HTMLElement;
  private _rootContainer: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _uiContainer: HTMLElement;
  private _options: ResolvedMolvisOptions;
  private _ownsRootContainer: boolean;
  private _ownsUiContainer: boolean;
  private _resolutionManager: ResolutionManager;

  constructor(canvas: HTMLCanvasElement, options: ResolvedMolvisOptions, dom: MolvisDomContext = {}) {
    this._canvas = canvas;
    this._options = options;

    this._rootContainer = dom.rootContainer ?? (canvas.parentElement as HTMLElement | undefined)!;
    this._mountPoint = dom.mountPoint ?? this._rootContainer?.parentElement ?? undefined!;
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

    this._resolutionManager = new ResolutionManager(options, this._mountPoint, canvas);
    this._applyCanvasSafetyDefaults();
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

  public get mountPoint(): HTMLElement {
    return this._mountPoint;
  }

  public get rootContainer(): HTMLElement {
    return this._rootContainer;
  }

  public get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  public get uiContainer(): HTMLElement {
    return this._uiContainer;
  }

  public get displaySize(): { width: number; height: number } {
    const element = this._rootContainer ?? this._canvas;
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  public get renderResolution(): { width: number; height: number } {
    return { width: this._canvas.width, height: this._canvas.height };
  }

  public get pixelRatio(): number {
    const size = this.displaySize;
    if (size.width === 0) {
      return this._options.pixelRatio;
    }
    return this._canvas.width / size.width;
  }

  public setSize(displayWidth: number, displayHeight: number): void {
    this._options.displayWidth = displayWidth;
    this._options.displayHeight = displayHeight;
    this._options.fitContainer = false;

    if (this._rootContainer) {
      this._rootContainer.style.width = `${displayWidth}px`;
      this._rootContainer.style.height = `${displayHeight}px`;
    }

    this._resolutionManager.setSize(displayWidth, displayHeight);
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._resolutionManager.setRenderResolution(renderWidth, renderHeight);
  }

  public enableFitContainer(enabled: boolean): void {
    this._options.fitContainer = enabled;

    if (!this._rootContainer) {
      return;
    }

    if (enabled) {
      this._rootContainer.style.width = "100%";
      this._rootContainer.style.height = "100%";

      this._resolutionManager.enableFitContainer(enabled);
    } else {
      const displayWidth = this._options.displayWidth;
      const displayHeight = this._options.displayHeight;
      this._rootContainer.style.width = `${displayWidth}px`;
      this._rootContainer.style.height = `${displayHeight}px`;
    }
  }

  public destroy(): void {
    if (this._ownsUiContainer && this._uiContainer.parentElement) {
      this._uiContainer.parentElement.removeChild(this._uiContainer);
    }

    if (this._ownsRootContainer && this._rootContainer && this._mountPoint?.contains(this._rootContainer)) {
      this._mountPoint.removeChild(this._rootContainer);
    }
  }
}