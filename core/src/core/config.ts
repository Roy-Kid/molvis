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
export interface UIConfig {
    showInfoPanel?: boolean;
    showModePanel?: boolean;
    showViewPanel?: boolean;
    showPerfPanel?: boolean;
    showTrajPanel?: boolean;
    showContextMenu?: boolean;
}

/**
 * Molvis configuration
 */
export interface MolvisConfig {
    // UI Display
    showUI?: boolean;
    useRightHandedSystem?: boolean;
    ui?: UIConfig;

    // Canvas settings
    canvas?: CanvasConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<MolvisConfig> & {
    ui: Required<UIConfig>;
    canvas: Required<CanvasConfig>;
} = {
    showUI: true,
    useRightHandedSystem: true,
    ui: {
        showModePanel: true,
        showViewPanel: true,
        showInfoPanel: true,
        showPerfPanel: true,
        showTrajPanel: true,
        showContextMenu: true
    },
    canvas: {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        stencil: true
    }
};

/**
 * Helper to create config.
 * Merges user config with defaults.
 */
export function defaultMolvisConfig(config: MolvisConfig = {}): MolvisConfig {
    return {
        showUI: config.showUI ?? DEFAULT_CONFIG.showUI,
        useRightHandedSystem: config.useRightHandedSystem ?? DEFAULT_CONFIG.useRightHandedSystem,
        ui: {
            showModePanel: config.ui?.showModePanel ?? DEFAULT_CONFIG.ui.showModePanel,
            showViewPanel: config.ui?.showViewPanel ?? DEFAULT_CONFIG.ui.showViewPanel,
            showInfoPanel: config.ui?.showInfoPanel ?? DEFAULT_CONFIG.ui.showInfoPanel,
            showPerfPanel: config.ui?.showPerfPanel ?? DEFAULT_CONFIG.ui.showPerfPanel,
            showTrajPanel: config.ui?.showTrajPanel ?? DEFAULT_CONFIG.ui.showTrajPanel,
            showContextMenu: config.ui?.showContextMenu ?? DEFAULT_CONFIG.ui.showContextMenu
        },
        canvas: {
            antialias: config.canvas?.antialias ?? DEFAULT_CONFIG.canvas.antialias,
            alpha: config.canvas?.alpha ?? DEFAULT_CONFIG.canvas.alpha,
            preserveDrawingBuffer: config.canvas?.preserveDrawingBuffer ?? DEFAULT_CONFIG.canvas.preserveDrawingBuffer,
            stencil: config.canvas?.stencil ?? DEFAULT_CONFIG.canvas.stencil
        }
    };
}
