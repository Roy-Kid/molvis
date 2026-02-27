import * as vscode from "vscode";
import type { Logger, PanelRegistry } from "../types";
import {
  createInitMessage,
  getMolvisWebviewOptions,
} from "../configuration";
import { getViewerHtml } from "./html";
import { onWebviewMessage, sendToWebview } from "./messaging";

export function openEditorPanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
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

  panel.webview.html = getViewerHtml(
    panel.webview,
    context.extensionUri,
    getMolvisWebviewOptions(),
  );

  const messageDisposable = onWebviewMessage(panel.webview, (message) => {
    switch (message.type) {
      case "ready":
        sendToWebview(panel.webview, createInitMessage("app"));
        break;
      case "error":
        logger.error(`MolVis: ${message.message}`);
        break;
      default:
        break;
    }
  });

  panelRegistry.register(panel, {
    getHtml: () =>
      getViewerHtml(
        panel.webview,
        context.extensionUri,
        getMolvisWebviewOptions(),
      ),
  });

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
  });
}
