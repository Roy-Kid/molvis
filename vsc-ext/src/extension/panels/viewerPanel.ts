import * as vscode from "vscode";
import type { PanelRegistry } from "../types";
import { getViewerHtml } from "./html";

export function openViewerPanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
): void {
  const panel = vscode.window.createWebviewPanel(
    "molvis.page",
    "MolVis Viewer",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri],
    },
  );

  panel.webview.html = getViewerHtml(panel.webview, context.extensionUri);

  panelRegistry.register(panel, {
    getHtml: () => getViewerHtml(panel.webview, context.extensionUri),
  });

  panel.onDidDispose(() => panelRegistry.unregister(panel));
}
