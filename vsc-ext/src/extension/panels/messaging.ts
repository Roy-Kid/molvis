import * as path from "node:path";
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
import {
  collapseMrecStoreUri,
  getDisplayName,
  isMrecUriPath,
} from "../loading/pathUtils";
import type { Logger } from "../types";

const rangeReader = new FileRangeReader();

/**
 * Upper bound on a single `readRange` request. Legitimate streaming chunks
 * are far smaller; the cap stops a webview from driving `Buffer.alloc` with
 * an arbitrary length.
 */
export const MAX_RANGE_BYTES = 512 * 1024 * 1024;

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
    uri = collapseMrecStoreUri(uri);
    const filename = getDisplayName(uri);
    const stat = await vscode.workspace.fs.stat(uri);
    const isMrec = isMrecUriPath(uri, stat.type);
    const format = isMrec ? null : await resolveFileFormat(filename);
    if (!isMrec && !format) {
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
    const { start, end } = message;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start
    ) {
      throw new Error(`invalid range [${start}, ${end})`);
    }
    if (end - start > MAX_RANGE_BYTES) {
      throw new Error(
        `range of ${end - start} bytes exceeds the ${MAX_RANGE_BYTES}-byte limit`,
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
    // Strip any directory part so a `../…` suggested name can't pre-fill the
    // dialog outside the workspace. The final save location is whatever the
    // user confirms in the native dialog.
    const safeName = path.basename(suggestedName);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, safeName)
      : vscode.Uri.file(safeName);

    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: saveDialogFilters(safeName),
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
  mode: LoadMode = "replace",
): Promise<void> {
  const uri = vscode.Uri.parse(uriString);
  // Loading reads through `vscode.workspace.fs` / byte ranges, which only
  // serve `file:` URIs (mirrors the guard in `handleRangeMessage`). Reject
  // anything else instead of failing obscurely deeper in the load path.
  if (uri.scheme !== "file") {
    logger.error(
      `MolVis: drop is only supported for file: URIs (${uri.scheme})`,
    );
    void vscode.window.showErrorMessage(
      `MolVis: cannot open a ${uri.scheme}: URI — only local files are supported.`,
    );
    return;
  }
  await sendLoadedFile(webview, uri, fileLoader, logger, mode);
}
