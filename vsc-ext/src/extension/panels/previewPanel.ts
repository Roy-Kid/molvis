import * as vscode from "vscode";
import type { Logger } from "../types";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import { onWebviewMessage, sendToWebview } from "./messaging";
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

export async function openPreviewPanel(
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

  if (!targetUri) {
    logger.error("MolVis: No file selected for preview");
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "molvis.preview",
    `Preview: ${getDisplayName(targetUri)}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri],
    },
  );

  panel.webview.html = getPreviewHtml(panel.webview, context.extensionUri);

  const reloadPreview = async () => {
    try {
      await sendLoadedFile(panel, targetUri, fileLoader);
    } catch (error) {
      logger.error(`MolVis: Failed to reload file: ${error}`);
    }
  };

  panelRegistry.register(panel, {
    getHtml: () => getPreviewHtml(panel.webview, context.extensionUri),
    reload: reloadPreview,
  });

  const messageDisposable = onWebviewMessage(panel.webview, async (message) => {
    if (message.type !== "ready") {
      return;
    }

    try {
      await sendLoadedFile(panel, targetUri, fileLoader);
    } catch (error) {
      logger.error(`MolVis: Failed to load file: ${error}`);
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
