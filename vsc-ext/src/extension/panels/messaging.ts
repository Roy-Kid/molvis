import { FILE_FORMAT_REGISTRY } from "@molcrafts/molvis-stage/io/formats";
import * as vscode from "vscode";
import type {
  HostToWebviewMessage,
  LoadMode,
  WebviewToHostMessage,
} from "../../protocol";
import { FileRangeReader } from "../loading/fileRangeReader";
import { resolveFileFormat } from "../loading/formatResolver";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName, isZarrUriPath } from "../loading/pathUtils";
import type { Logger } from "../types";

const rangeReader = new FileRangeReader();

/**
 * Send a message from extension host to webview.
 */
export function sendToWebview(
  webview: vscode.Webview,
  message: HostToWebviewMessage,
): void {
  webview.postMessage(message);
}

export async function sendLoadedFile(
  webview: vscode.Webview,
  uri: vscode.Uri,
  fileLoader: MolecularFileLoader,
  logger: Logger,
  mode?: LoadMode,
): Promise<void> {
  try {
    const filename = getDisplayName(uri);
    const stat = await vscode.workspace.fs.stat(uri);
    const isZarr = isZarrUriPath(uri, stat.type);
    const format = isZarr ? null : await resolveFileFormat(filename);
    if (!isZarr && !format) {
      logger.info(`MolVis: user cancelled format picker for ${filename}`);
      return;
    }
    const loaded = await fileLoader.load(uri, format ?? undefined);
    if (loaded.openUri && format) {
      let index: Uint8Array | undefined;
      try {
        index = await vscode.workspace.fs.readFile(
          vscode.Uri.parse(`${uri.toString()}.molidx`),
        );
      } catch {
        // no sibling sidecar
      }
      const mb = loaded.openUri.size / (1024 * 1024);
      logger.info(
        `MolVis: streaming ${filename} (${mb.toFixed(1)} MB) via byte ranges`,
      );
      sendToWebview(webview, {
        type: "openUri",
        uri: uri.toString(),
        filename: loaded.filename,
        format,
        size: loaded.openUri.size,
        mtime: loaded.openUri.mtime,
        ...(mode ? { mode } : {}),
        ...(index ? { index } : {}),
      });
      return;
    }
    sendToWebview(webview, {
      type: "loadFile",
      content: loaded.payload,
      filename: loaded.filename,
      ...(format ? { format } : {}),
      ...(loaded.stream ? { stream: true } : {}),
      ...(mode ? { mode } : {}),
    });
  } catch (error) {
    logger.error(`MolVis: Failed to load file: ${error}`);
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`MolVis: ${message}`);
  }
}

/**
 * Set up message listener for webview-to-host communication.
 */
export function onWebviewMessage(
  webview: vscode.Webview,
  handler: (message: WebviewToHostMessage) => void,
): vscode.Disposable {
  return webview.onDidReceiveMessage(handler);
}

/**
 * Handle `readRange` / `cancelRange` from the webview. Returns true when
 * the message was consumed.
 */
export async function handleRangeMessage(
  webview: vscode.Webview,
  message: WebviewToHostMessage,
  logger: Logger,
): Promise<boolean> {
  if (message.type === "cancelRange") {
    rangeReader.cancel(message.fetchId);
    return true;
  }
  if (message.type !== "readRange") return false;
  try {
    const uri = vscode.Uri.parse(message.uri);
    if (uri.scheme !== "file") {
      throw new Error(
        `range read is only supported for file: URIs (${uri.scheme})`,
      );
    }
    const data = await rangeReader.read(
      uri.fsPath,
      message.start,
      message.end,
      message.fetchId,
    );
    // `data` is already a packed Uint8Array. Post it as-is so VS Code's
    // buffer serializer can extract the ArrayBuffer instead of JSON.
    sendToWebview(webview, { type: "bytes", fetchId: message.fetchId, data });
  } catch (error) {
    logger.error(`MolVis: range read failed: ${error}`);
    sendToWebview(webview, {
      type: "bytes",
      fetchId: message.fetchId,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return true;
}

/**
 * Handle saveFile message from webview: show native save dialog and write file.
 */
export async function handleSaveFile(
  base64Data: string,
  suggestedName: string,
  logger: Logger,
): Promise<void> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, suggestedName)
      : vscode.Uri.file(suggestedName);

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: saveDialogFilters(suggestedName),
    });
    if (!uri) return;

    const binary = Buffer.from(base64Data, "base64");
    await vscode.workspace.fs.writeFile(uri, binary);
  } catch (error) {
    logger.error(`MolVis: Failed to save file: ${error}`);
  }
}

function saveDialogFilters(suggestedName: string): Record<string, string[]> {
  const extension = suggestedName.split(".").pop()?.toLowerCase();
  if (extension === "svg") return { "SVG image": ["svg"] };
  if (extension === "png") return { "PNG image": ["png"] };
  return {
    // Every extension molrs can write, straight from the format registry.
    "Molecular files": FILE_FORMAT_REGISTRY.filter(
      (descriptor) => descriptor.writable,
    ).flatMap((descriptor) => descriptor.extensions),
  };
}

/**
 * Read document contents and send to webview.
 */
export async function loadTextDocumentToWebview(
  webview: vscode.Webview,
  document: vscode.TextDocument,
  logger?: Logger,
): Promise<void> {
  const filename = getDisplayName(document.uri);
  const format = await resolveFileFormat(filename);
  if (!format) {
    logger?.info(`MolVis: user cancelled format picker for ${filename}`);
    return;
  }
  sendToWebview(webview, {
    type: "loadFile",
    content: document.getText(),
    filename,
    format,
  });
}

export async function handleDropUri(
  uriString: string,
  webview: vscode.Webview,
  fileLoader: MolecularFileLoader,
  logger: Logger,
): Promise<void> {
  // Drag/drop is conservative: replace the current scene. Multi-source augment
  // and atom-set extend are explicit load modes in the webview UI.
  await sendLoadedFile(
    webview,
    vscode.Uri.parse(uriString),
    fileLoader,
    logger,
  );
}
