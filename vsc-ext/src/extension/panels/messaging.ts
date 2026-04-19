import * as vscode from "vscode";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { getDisplayName } from "../loading/pathUtils";
import type {
  HostToWebviewMessage,
  Logger,
  WebviewToHostMessage,
} from "../types";

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
): Promise<void> {
  try {
    const loaded = await fileLoader.load(uri);
    sendToWebview(webview, {
      type: "loadFile",
      content: loaded.payload,
      filename: loaded.filename,
    });
  } catch (error) {
    logger.error(`MolVis: Failed to load file: ${error}`);
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
      filters: {
        "Molecular files": ["pdb", "xyz", "lammps", "dump", "lammpstrj"],
      },
    });
    if (!uri) return;

    const binary = Buffer.from(base64Data, "base64");
    await vscode.workspace.fs.writeFile(uri, binary);
  } catch (error) {
    logger.error(`MolVis: Failed to save file: ${error}`);
  }
}

/**
 * Read document contents and send to webview.
 */
export async function loadTextDocumentToWebview(
  webview: vscode.Webview,
  document: vscode.TextDocument,
): Promise<void> {
  sendToWebview(webview, {
    type: "loadFile",
    content: document.getText(),
    filename: getDisplayName(document.uri),
  });
}

export async function handleDropUri(
  uriString: string,
  webview: vscode.Webview,
  fileLoader: MolecularFileLoader,
  logger: Logger,
): Promise<void> {
  await sendLoadedFile(
    webview,
    vscode.Uri.parse(uriString),
    fileLoader,
    logger,
  );
}
