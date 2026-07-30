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

export function isAnalysisPanelOpen(size: number): boolean {
  return size > 0;
}
