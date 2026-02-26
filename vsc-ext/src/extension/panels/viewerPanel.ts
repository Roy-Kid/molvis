import * as vscode from "vscode";
import type { PanelRegistry } from "../types";
import { getViewerHtml } from "./html";

export function openEditorPanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
): void {
  const panel = vscode.window.createWebviewPanel(
    "molvis.workspace",
    "MolVis Editor",
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
