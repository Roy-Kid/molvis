/**
 * Molvis configuration - simplified
 */

// Canvas settings
export interface CanvasConfig {
    antialias?: boolean;
    alpha?: boolean;
    preserveDrawingBuffer?: boolean;
    stencil?: boolean;
}

// UI components configuration
export interface UIComponentsConfig {
    showInfoPanel?: boolean;
    showModePanel?: boolean;
    showViewPanel?: boolean;
    showFrameIndicator?: boolean;
}

// Grid configuration
export interface GridConfig {
    enabled?: boolean;
    mainColor?: string;
    lineColor?: string;
    opacity?: number;
    majorUnitFrequency?: number;
    minorUnitVisibility?: number;
    size?: number;
}

/**
 * Molvis configuration
 */
export interface MolvisConfig {
    // UI Display
    showUI?: boolean;
    uiComponents?: UIComponentsConfig;

    // Canvas settings
    canvas?: CanvasConfig;

    // Grid settings
    grid?: GridConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<MolvisConfig> & {
    uiComponents: Required<UIComponentsConfig>;
    canvas: Required<CanvasConfig>;
    grid: Required<GridConfig>;
} = {
    showUI: true,
    uiComponents: {
        showModePanel: true,
        showViewPanel: true,
        showInfoPanel: true,
        showFrameIndicator: true
    },
    canvas: {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        stencil: true
    },
    grid: {
        enabled: false,
        mainColor: '#888888',
        lineColor: '#444444',
        opacity: 0.5,
        majorUnitFrequency: 10,
        minorUnitVisibility: 0.5,
        size: 100
    }
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(config: MolvisConfig = {}): MolvisConfig {
    return {
        showUI: config.showUI ?? DEFAULT_CONFIG.showUI,
        uiComponents: {
            showModePanel: config.uiComponents?.showModePanel ?? DEFAULT_CONFIG.uiComponents.showModePanel,
            showViewPanel: config.uiComponents?.showViewPanel ?? DEFAULT_CONFIG.uiComponents.showViewPanel,
            showInfoPanel: config.uiComponents?.showInfoPanel ?? DEFAULT_CONFIG.uiComponents.showInfoPanel,
            showFrameIndicator: config.uiComponents?.showFrameIndicator ?? DEFAULT_CONFIG.uiComponents.showFrameIndicator
        },
        canvas: {
            antialias: config.canvas?.antialias ?? DEFAULT_CONFIG.canvas.antialias,
            alpha: config.canvas?.alpha ?? DEFAULT_CONFIG.canvas.alpha,
            preserveDrawingBuffer: config.canvas?.preserveDrawingBuffer ?? DEFAULT_CONFIG.canvas.preserveDrawingBuffer,
            stencil: config.canvas?.stencil ?? DEFAULT_CONFIG.canvas.stencil
        },
        grid: {
            enabled: config.grid?.enabled ?? DEFAULT_CONFIG.grid.enabled,
            mainColor: config.grid?.mainColor ?? DEFAULT_CONFIG.grid.mainColor,
            lineColor: config.grid?.lineColor ?? DEFAULT_CONFIG.grid.lineColor,
            opacity: config.grid?.opacity ?? DEFAULT_CONFIG.grid.opacity,
            majorUnitFrequency: config.grid?.majorUnitFrequency ?? DEFAULT_CONFIG.grid.majorUnitFrequency,
            minorUnitVisibility: config.grid?.minorUnitVisibility ?? DEFAULT_CONFIG.grid.minorUnitVisibility,
            size: config.grid?.size ?? DEFAULT_CONFIG.grid.size
        }
    };
}
