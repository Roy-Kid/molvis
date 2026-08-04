export interface ViewerPanelLayoutOptions {
  showAnalysis: boolean;
  showTools: boolean;
}

export interface ViewerPanelLayout {
  defaultLayout: Record<string, number>;
  analysisSize: string;
  canvasSize: string;
  toolsSize: string;
}

/**
 * Resolve the wide viewer shell's initial panel sizes.
 *
 * Analysis keeps a zero-width resizable slot so it can be pulled out from the
 * left edge without occupying canvas space on first render.
 */
export function resolveViewerPanelLayout({
  showAnalysis,
  showTools,
}: ViewerPanelLayoutOptions): ViewerPanelLayout {
  if (showAnalysis && showTools) {
    return {
      defaultLayout: { analysis: 0, canvas: 85, tools: 15 },
      analysisSize: "0%",
      canvasSize: "85%",
      toolsSize: "15%",
    };
  }

  if (showAnalysis) {
    return {
      defaultLayout: { analysis: 0, canvas: 100 },
      analysisSize: "0%",
      canvasSize: "100%",
      toolsSize: "0%",
    };
  }

  if (showTools) {
    return {
      defaultLayout: { canvas: 78, tools: 22 },
      analysisSize: "0%",
      canvasSize: "78%",
      toolsSize: "22%",
    };
  }

  return {
    defaultLayout: { canvas: 100 },
    analysisSize: "0%",
    canvasSize: "100%",
    toolsSize: "0%",
  };
}

/**
 * Minimum open width (% of workbench). Dragging below this snaps the panel
 * fully closed (collapsible + collapsedSize 0%).
 */
export const SIDE_PANEL_MIN_PCT = 12;

/** Default width % when a closed side panel is reopened from chrome. */
export const SIDE_PANEL_OPEN_DEFAULT_PCT = 18;

/** Side panels are "open" only at/above the minimum open width. */
export function isSidePanelOpen(size: number): boolean {
  return size >= SIDE_PANEL_MIN_PCT - 0.25;
}

// ---------------------------------------------------------------------------
// Drag-resized horizontal splits
// ---------------------------------------------------------------------------

/**
 * Shared limits for panels the user drags to resize.
 *
 * The pipeline properties pane and the workbench bottom panel keep separate
 * interaction models (window listeners vs pointer capture, snap-close vs
 * not), but they had also each re-typed these three numbers. One drifting
 * copy is enough for two panels to stop agreeing on how small "too small" is.
 */
export const RESIZE_MIN_HEIGHT_PX = 100;

/** Fraction of the container a drag-resized panel may occupy. */
export const RESIZE_MAX_HEIGHT_RATIO = 0.55;

/** Height step for ArrowUp / ArrowDown on a resize handle. */
export const RESIZE_KEYBOARD_STEP_PX = 16;

/**
 * Largest height a drag-resized panel may take inside `containerHeight`.
 * Never below {@link RESIZE_MIN_HEIGHT_PX}, so a short container still
 * yields a usable panel rather than a zero-height sliver.
 */
export function maxResizeHeight(containerHeight: number): number {
  return Math.max(
    RESIZE_MIN_HEIGHT_PX,
    Math.floor(containerHeight * RESIZE_MAX_HEIGHT_RATIO),
  );
}

/** Clamp a dragged height into `[min, maxResizeHeight(containerHeight)]`. */
export function clampResizeHeight(
  desired: number,
  containerHeight: number,
  minHeight: number = RESIZE_MIN_HEIGHT_PX,
): number {
  const maxH = maxResizeHeight(containerHeight);
  return Math.max(Math.min(minHeight, maxH), Math.min(desired, maxH));
}
