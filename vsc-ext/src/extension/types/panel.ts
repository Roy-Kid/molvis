import type * as vscode from "vscode";

/**
 * Metadata for a tracked webview panel used by extension-side reload behavior.
 */
export interface WebviewPanelMeta {
  getHtml: () => string;
  reload?: () => Promise<void>;
}

export interface PanelRegistry {
  register(panel: vscode.WebviewPanel, meta: WebviewPanelMeta): void;
  unregister(panel: vscode.WebviewPanel): void;
  forEachVisible(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void>;
  forEach(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void>;
}
