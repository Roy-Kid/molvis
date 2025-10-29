import type { ResolvedMolvisOptions } from "./options";

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

export class ResolutionManager {
  private _options: ResolvedMolvisOptions;
  private _mountPoint: HTMLElement;
  private _canvas: HTMLCanvasElement;

  constructor(options: ResolvedMolvisOptions, mountPoint: HTMLElement, canvas: HTMLCanvasElement) {
    this._options = options;
    this._mountPoint = mountPoint;
    this._canvas = canvas;
  }

  public applyCanvasDefaults(): void {
    applyCanvasDefaults(this._canvas, this._options, this._mountPoint);
  }

  public computeRenderResolution(): { width: number; height: number } {
    return computeRenderResolution(this._options, this._mountPoint);
  }

  public updateOptions(options: ResolvedMolvisOptions): void {
    this._options = options;
  }

  public setRenderResolution(renderWidth: number, renderHeight: number): void {
    this._options.renderWidth = renderWidth;
    this._options.renderHeight = renderHeight;
    this._options.autoRenderResolution = false;

    this._canvas.width = renderWidth;
    this._canvas.height = renderHeight;
  }

  public setSize(displayWidth: number, displayHeight: number): void {
    this._options.displayWidth = displayWidth;
    this._options.displayHeight = displayHeight;
    this._options.fitContainer = false;

    if (this._options.autoRenderResolution) {
      const pixelRatio = this._options.pixelRatio;
      this._canvas.width = Math.floor(displayWidth * pixelRatio);
      this._canvas.height = Math.floor(displayHeight * pixelRatio);
    } else {
      this._canvas.width = this._options.renderWidth ?? displayWidth;
      this._canvas.height = this._options.renderHeight ?? displayHeight;
    }
  }

  public enableFitContainer(enabled: boolean): void {
    this._options.fitContainer = enabled;

    if (enabled) {
      if (this._options.autoRenderResolution) {
        const pixelRatio = this._options.pixelRatio;
        const width =
          this._mountPoint.clientWidth ?? this._options.displayWidth;
        const height =
          this._mountPoint.clientHeight ?? this._options.displayHeight;
        this._canvas.width = Math.floor(width * pixelRatio);
        this._canvas.height = Math.floor(height * pixelRatio);
      }
    }
  }
}