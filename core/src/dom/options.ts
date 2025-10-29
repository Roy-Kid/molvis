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