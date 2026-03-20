import * as vscode from "vscode";
import { createInitMessage } from "../configuration";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import type { Logger } from "../types";
import type { PanelRegistry } from "../types";
import { withErrorHandler } from "./errorBoundary";
import { getPreviewHtml } from "./html";
import { handleSaveFile, onWebviewMessage, sendToWebview } from "./messaging";

async function sendLoadedFile(
  panel: vscode.WebviewPanel,
  uri: vscode.Uri,
  fileLoader: MolecularFileLoader,
): Promise<void> {
  const loaded = await fileLoader.load(uri);
  sendToWebview(panel.webview, {
    type: "loadFile",
    content: loaded.payload,
    filename: loaded.filename,
  });
}

export async function openQuickViewPanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
  fileLoader: MolecularFileLoader,
  uri?: vscode.Uri,
): Promise<void> {
  let targetUri = uri;
  if (!targetUri) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      targetUri = activeEditor.document.uri;
    }
  }

  const title = targetUri
    ? `Quick View: ${getDisplayName(targetUri)}`
    : "Quick View";

  const panel = vscode.window.createWebviewPanel(
    "molvis.quickView",
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri],
    },
  );

  panel.webview.html = getPreviewHtml(panel.webview, context.extensionUri);

  const reloadPreview = targetUri
    ? async () => {
        try {
          await sendLoadedFile(panel, targetUri, fileLoader);
        } catch (error) {
          logger.error(`MolVis: Failed to reload file: ${error}`);
        }
      }
    : undefined;

  panelRegistry.register(panel, {
    getHtml: () => getPreviewHtml(panel.webview, context.extensionUri),
    reload: reloadPreview,
  });

  const baseTitle = panel.title;
  const messageDisposable = onWebviewMessage(
    panel.webview,
    withErrorHandler(async (message) => {
      switch (message.type) {
        case "ready":
          sendToWebview(panel.webview, createInitMessage("standalone"));
          if (targetUri) {
            await sendLoadedFile(panel, targetUri, fileLoader);
          }
          break;
        case "saveFile":
          await handleSaveFile(message.data, message.suggestedName, logger);
          break;
        case "dirtyStateChanged":
          panel.title = message.isDirty ? `● ${baseTitle}` : baseTitle;
          break;
        case "error":
          logger.error(`MolVis: ${message.message}`);
          break;
        default:
          break;
      }
    }, logger),
  );

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
  });
}
