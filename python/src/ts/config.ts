/**
 * Widget configuration defaults.
 * Simplified to core essentials for anywidget integration.
 */

import { type MolvisConfig as CoreMolvisConfig, defaultMolvisConfig } from "@molvis/core";

// Default widget configuration (passed to core)
export const DEFAULT_CONFIG = defaultMolvisConfig({
  showUI: true,
  ui: {
    showModePanel: true,
    showViewPanel: true,
    showInfoPanel: true,
  },
});

// Environment detection for Jupyter contexts
export const ENVIRONMENT = {
  isJupyter: typeof window !== "undefined" && window.location.href.includes("jupyter"),
  isNotebook: typeof window !== "undefined" && window.location.href.includes("notebook"),
  isLab: typeof window !== "undefined" && window.location.href.includes("lab"),
};
