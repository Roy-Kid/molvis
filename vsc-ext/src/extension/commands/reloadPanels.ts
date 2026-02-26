import * as vscode from "vscode";
import type { PanelRegistry } from "../types/panel";

export function registerReloadPanelsCommand(
  panelRegistry: PanelRegistry,
): vscode.Disposable {
  return vscode.commands.registerCommand("molvis.reload", async () => {
    await panelRegistry.forEachVisible(async (panel, meta) => {
      if (meta.reload) {
        await meta.reload();
        return;
      }

      panel.webview.html = meta.getHtml();
    });
  });
}
