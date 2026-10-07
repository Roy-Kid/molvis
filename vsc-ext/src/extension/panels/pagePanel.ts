import * as vscode from "vscode";
import { createInitMessage } from "../configuration";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import type { Logger, PanelRegistry } from "../types";
import { withErrorHandler } from "./errorBoundary";
import { getPageHtml } from "./html";
import {
  handleDropUri,
  handleRangeMessage,
  handleSaveFile,
  onWebviewMessage,
  sendLoadedFile,
  sendToWebview,
} from "./messaging";

export const PAGE_VIEW_TYPE = "molvis.page";

export type OpenPagePanelOptions = {
  /** File to load once the page reports ready. */
  uri?: vscode.Uri;
  /** Column to open in — the Quick look column when promoting that tab. */
  viewColumn?: vscode.ViewColumn;
};

/**
 * Full React product shell from `page/`. Peer of Stage and Sketch tabs.
 */
export function openPagePanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
  fileLoader: MolecularFileLoader,
  options?: OpenPagePanelOptions,
): vscode.WebviewPanel {
  const uri = options?.uri;
  const baseTitle = uri ? `MolVis: ${getDisplayName(uri)}` : "MolVis";

  const panel = vscode.window.createWebviewPanel(
    PAGE_VIEW_TYPE,
    baseTitle,
    {
      viewColumn: options?.viewColumn ?? vscode.ViewColumn.One,
      preserveFocus: false,
    },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  const getHtml = () => getPageHtml(panel.webview, context.extensionUri);
  panel.webview.html = getHtml();

  const messageDisposable = onWebviewMessage(
    panel.webview,
    withErrorHandler(async (message) => {
      switch (message.type) {
        case "ready":
          sendToWebview(panel.webview, createInitMessage("full"));
          if (uri) {
            await sendLoadedFile(panel.webview, uri, fileLoader, logger);
          }
          break;
        case "saveFile":
          await handleSaveFile(message.data, message.suggestedName, logger);
          break;
        case "dropUri":
          await handleDropUri(
            message.uri,
            panel.webview,
            fileLoader,
            logger,
            message.mode,
          );
          break;
        case "dirtyStateChanged":
          panel.title = message.isDirty ? `● ${baseTitle}` : baseTitle;
          break;
        case "error":
          logger.error(`MolVis Page: ${message.message}`);
          break;
        default:
          if (await handleRangeMessage(panel.webview, message, logger)) {
            break;
          }
          break;
      }
    }, logger),
  );

  panelRegistry.register(panel, {
    getHtml,
    viewType: PAGE_VIEW_TYPE,
    ...(uri
      ? {
          sourceUri: uri,
          reload: async () => {
            await sendLoadedFile(panel.webview, uri, fileLoader, logger);
          },
        }
      : {}),
  });

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
  });

  return panel;
}
