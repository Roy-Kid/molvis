import * as vscode from "vscode";
import type { Logger } from "../types";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import { handleSaveFile, onWebviewMessage, sendToWebview } from "./messaging";
import type { PanelRegistry } from "../types";
import { getPreviewHtml } from "./html";

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

  const messageDisposable = onWebviewMessage(panel.webview, async (message) => {
    switch (message.type) {
      case "ready":
        if (targetUri) {
          try {
            await sendLoadedFile(panel, targetUri, fileLoader);
          } catch (error) {
            logger.error(`MolVis: Failed to load file: ${error}`);
          }
        }
        break;
      case "saveFile":
        await handleSaveFile(message.data, message.suggestedName);
        break;
      case "error":
        logger.error(`MolVis: ${message.message}`);
        break;
      default:
        break;
    }
  });

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
  });

  sendToWebview(panel.webview, {
    type: "init",
    mode: "standalone",
    config: { showUI: true },
  });
}
