export const MOLVIS_UI_CSS = `
.molvis-ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.molvis-panel {
  position: absolute;
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: auto;
  user-select: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

.molvis-view-panel {
  top: 12px;
  left: 12px;
}

.molvis-mode-panel {
  top: 12px;
  right: 12px;
}
.molvis-info-panel {
  bottom: 12px;
  left: 12px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  display: none;
}

.molvis-info-panel.visible {
  display: block;
}

.molvis-perf-panel {
  bottom: 12px;
  right: 12px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
}
`;
