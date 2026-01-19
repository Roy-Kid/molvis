// GUI 样式常量
export const MOLVIS_UI_CSS = `
/* Overlay 容器 */
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

/* 统一 Panel 样式 - 简单透明文本 */
.molvis-panel {
  position: absolute;
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: auto;
  user-select: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

/* ViewPanel - 左上角 */
.molvis-view-panel {
  top: 10px;
  left: 10px;
}

/* ModePanel - 右上角 */
.molvis-mode-panel {
  top: 10px;
  right: 10px;
}

/* InfoPanel - 左下角 */
.molvis-info-panel {
  bottom: 10px;
  left: 10px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  display: none;
}

.molvis-info-panel.visible {
  display: block;
}
`;
