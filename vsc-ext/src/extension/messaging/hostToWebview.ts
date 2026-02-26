import * as path from "node:path";
import type * as vscode from "vscode";
import type {
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "../types/messages";

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
