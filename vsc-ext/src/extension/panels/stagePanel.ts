import * as vscode from "vscode";
import type { StructureOutlinePayload } from "../../protocol";
import { createInitMessage } from "../configuration";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import type { Logger, PanelRegistry } from "../types";
import { withErrorHandler } from "./errorBoundary";
import { getPreviewHtml } from "./html";
import {
  handleDropUri,
  handleRangeMessage,
  handleSaveFile,
  onWebviewMessage,
  sendLoadedFile,
  sendToWebview,
} from "./messaging";

export type OpenStagePanelOptions = {
  onStructureOutline?: (outline: StructureOutlinePayload | null) => void;
};

export const STAGE_VIEW_TYPE = "molvis.stage";

/** Dedicated 3D stage editor tab. Peer of the Sketch tab — not a sidebar. */
export function openStagePanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
  fileLoader: MolecularFileLoader,
  uri?: vscode.Uri,
  options?: OpenStagePanelOptions,
): vscode.WebviewPanel {
  const onStructureOutline = options?.onStructureOutline;
  const baseTitle = uri
    ? `MolVis Stage: ${getDisplayName(uri)}`
    : "MolVis Stage";

  const panel = vscode.window.createWebviewPanel(
    STAGE_VIEW_TYPE,
    baseTitle,
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  const getHtml = () => getPreviewHtml(panel.webview, context.extensionUri);
  panel.webview.html = getHtml();

  const messageDisposable = onWebviewMessage(
    panel.webview,
    withErrorHandler(async (message) => {
      switch (message.type) {
        case "ready":
          sendToWebview(panel.webview, createInitMessage());
          if (uri) {
            await sendLoadedFile(panel.webview, uri, fileLoader, logger);
          }
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
        case "structureOutline":
          onStructureOutline?.(message.outline);
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
          if (await handleRangeMessage(panel.webview, message, logger)) {
            break;
          }
          break;
      }
    }, logger),
  );

  panelRegistry.register(panel, {
    getHtml,
    viewType: STAGE_VIEW_TYPE,
  });

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
    onStructureOutline?.(null);
  });

  return panel;
}
