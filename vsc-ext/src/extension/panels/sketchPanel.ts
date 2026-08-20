import * as vscode from "vscode";
import type { StructureOutlinePayload } from "../../protocol";
import { createInitMessage } from "../configuration";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import type { Logger, PanelRegistry } from "../types";
import { withErrorHandler } from "./errorBoundary";
import { getSketchHtml } from "./html";
import {
  handleDropUri,
  handleSaveFile,
  onWebviewMessage,
  sendLoadedFile,
  sendToWebview,
} from "./messaging";

export type OpenSketchPanelOptions = {
  onStructureOutline?: (outline: StructureOutlinePayload | null) => void;
};

export const SKETCH_VIEW_TYPE = "molvis.sketch";

/** Dedicated 2D sketch editor tab. Peer of the Stage tab — not a sidebar. */
export function openSketchPanel(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
  fileLoader: MolecularFileLoader,
  uri?: vscode.Uri,
  options?: OpenSketchPanelOptions,
): vscode.WebviewPanel {
  const onStructureOutline = options?.onStructureOutline;
  const baseTitle = uri
    ? `MolVis Sketch: ${getDisplayName(uri)}`
    : "MolVis Sketch";

  const panel = vscode.window.createWebviewPanel(
    SKETCH_VIEW_TYPE,
    baseTitle,
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "out")],
    },
  );

  const getHtml = () => getSketchHtml(panel.webview, context.extensionUri);
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
          logger.error(`MolVis Sketch: ${message.message}`);
          break;
        default:
          break;
      }
    }, logger),
  );

  panelRegistry.register(panel, {
    getHtml,
    viewType: SKETCH_VIEW_TYPE,
  });

  panel.onDidDispose(() => {
    panelRegistry.unregister(panel);
    messageDisposable.dispose();
    onStructureOutline?.(null);
  });

  return panel;
}
