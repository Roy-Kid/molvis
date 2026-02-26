import * as path from "node:path";
import * as vscode from "vscode";
import type {
  HostToWebviewMessage,
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
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const defaultUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, suggestedName)
    : vscode.Uri.file(suggestedName);

  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: {
      "Molecular files": ["pdb", "xyz", "lammps"],
    },
  });
  if (!uri) return;

  const binary = Buffer.from(base64Data, "base64");
  await vscode.workspace.fs.writeFile(uri, binary);
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
    filename: path.basename(document.uri.fsPath) || "unknown",
  });
}
