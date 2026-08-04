import { describe, expect, it } from "@rstest/core";
import {
  isSidePanelOpen,
  resolveViewerPanelLayout,
  SIDE_PANEL_MIN_PCT,
} from "../src/lib/viewer-layout";

describe("wide viewer panel layout", () => {
  it("starts Analysis collapsed while retaining space for the right tool panel", () => {
    const layout = resolveViewerPanelLayout({
      showAnalysis: true,
      showTools: true,
    });

    expect(layout.defaultLayout).toEqual({
      analysis: 0,
      canvas: 85,
      tools: 15,
    });
    expect(layout.analysisSize).toBe("0%");
    expect(layout.canvasSize).toBe("85%");
    expect(layout.toolsSize).toBe("15%");
  });

  it("treats widths below the minimum as closed", () => {
    expect(isSidePanelOpen(0)).toBe(false);
    expect(isSidePanelOpen(SIDE_PANEL_MIN_PCT - 1)).toBe(false);
    expect(isSidePanelOpen(SIDE_PANEL_MIN_PCT)).toBe(true);
    expect(isSidePanelOpen(18)).toBe(true);
  });
});
