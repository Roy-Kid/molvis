/**
 * Widget configuration defaults.
 * Simplified to core essentials for anywidget integration.
 */

import type { MolvisConfig as CoreMolvisConfig } from "@molvis/core";

// Default widget configuration (passed to core)
export const DEFAULT_CONFIG: Partial<CoreMolvisConfig> = {
  showUI: true,
  uiComponents: {
    showModePanel: true,
    showViewPanel: true,
    showInfoPanel: true,
    showFrameIndicator: true,
  },
};

// Environment detection for Jupyter contexts
export const ENVIRONMENT = {
  isJupyter: typeof window !== "undefined" && window.location.href.includes("jupyter"),
  isNotebook: typeof window !== "undefined" && window.location.href.includes("notebook"),
  isLab: typeof window !== "undefined" && window.location.href.includes("lab"),
};
