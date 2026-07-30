import { describe, expect, it } from "@rstest/core";
import appSource from "../src/App.tsx?raw";
import {
  isAnalysisPanelOpen,
  resolveViewerPanelLayout,
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

  it("treats a dragged Analysis panel with any positive width as open", () => {
    expect(isAnalysisPanelOpen(0)).toBe(false);
    expect(isAnalysisPanelOpen(12)).toBe(true);
  });

  it("wires the shared contract into App and keeps a collapsible resize rail", () => {
    expect(appSource).toMatch(
      /import\s*\{[^}]*isAnalysisPanelOpen[^}]*resolveViewerPanelLayout[^}]*\}\s*from\s*["']\.\/lib\/viewer-layout["']/s,
    );
    expect(appSource).toContain("resolveViewerPanelLayout({");
    expect(appSource).toContain("isAnalysisPanelOpen(layout.analysis)");
    expect(appSource).toMatch(
      /<ResizablePanel[\s\S]*?id="analysis"[\s\S]*?collapsible[\s\S]*?collapsedSize="0%"/,
    );
    expect(appSource).toContain('aria-label="Resize analysis panel"');
  });
});
