import { createWorkbenchLayout } from "@molcrafts/ui";

export {
  COARSE_POINTER_INLINE_PANEL_BREAKPOINT,
  clampResizeHeight,
  INLINE_PANEL_BREAKPOINT,
  maxResizeHeight,
  RESIZE_KEYBOARD_STEP_PX,
  RESIZE_MAX_HEIGHT_RATIO,
  RESIZE_MIN_HEIGHT_PX,
  SIDE_PANEL_MIN_TRAVEL_PCT,
} from "@molcrafts/ui";

export const SIDE_PANEL = {
  minPct: 10.5,
  maxPct: 30,
  openDefaultPct: 10.5,
} as const;
export const SIDE_PANEL_MIN_PX = 168;
export const CANVAS_MIN_PCT = 100 - SIDE_PANEL.maxPct;
export const {
  sidePanelMinPct,
  sidePanelMaxPct,
  isSidePanelOpen,
  resolveWorkbenchPanelLayout,
} = createWorkbenchLayout({ ...SIDE_PANEL, minWidthPx: SIDE_PANEL_MIN_PX });
