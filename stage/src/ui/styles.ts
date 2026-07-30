export const MOLVIS_UI_CSS = `
/* Overlay must live inside .molvis-root (position:relative). Host mounts should
   also be positioned; createMolvisDOM enforces that on the container. */
.molvis-root {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  /*
   * Do not hardcode --molvis-ui-* here: product shells (page Tailwind) set
   * them on .molvis-root. Menu WCs fall back inside SHARED_CSS when unset.
   * Injecting defaults at runtime would clobber host tokens loaded earlier.
   */
}

.molvis-ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  font-family: var(
    --molvis-ui-font,
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif
  );
  font-size: var(--molvis-ui-font-size, 0.8125rem);
  color: var(--molvis-ui-fg, oklch(0.93 0.008 255));
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
