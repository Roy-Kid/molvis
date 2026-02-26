import type * as vscode from "vscode";
import type { PanelRegistry, WebviewPanelMeta } from "../types/panel";

/**
 * In-memory registry for active webview panels and their reload metadata.
 */
export class InMemoryPanelRegistry implements PanelRegistry {
  private readonly panels = new Map<vscode.WebviewPanel, WebviewPanelMeta>();

  public register(panel: vscode.WebviewPanel, meta: WebviewPanelMeta): void {
    this.panels.set(panel, meta);
  }

  public unregister(panel: vscode.WebviewPanel): void {
    this.panels.delete(panel);
  }

  public async forEachVisible(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void> {
    for (const [panel, meta] of this.panels) {
      if (panel.visible) {
        await callback(panel, meta);
      }
    }
  }

  public async forEach(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void> {
    for (const [panel, meta] of this.panels) {
      await callback(panel, meta);
    }
  }
}
