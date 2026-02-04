import type * as vscode from "vscode";
import type {
  HostToWebviewMessage,
  WebviewToHostMessage,
} from "./types/messages";

/**
 * Send a message from extension host to webview
 */
export function sendToWebview(
  webview: vscode.Webview,
  message: HostToWebviewMessage,
): void {
  webview.postMessage(message);
}

/**
 * Set up message listener for webview-to-host communication
 */
export function onWebviewMessage(
  webview: vscode.Webview,
  handler: (message: WebviewToHostMessage) => void,
): vscode.Disposable {
  return webview.onDidReceiveMessage(handler);
}

/**
 * Read file contents and send to webview
 */
export async function loadFileToWebview(
  webview: vscode.Webview,
  document: vscode.TextDocument,
): Promise<void> {
  const content = document.getText();
  const filename = document.uri.fsPath.split("/").pop() || "unknown";

  sendToWebview(webview, {
    type: "loadFile",
    content,
    filename,
  });
}

/**
 * Send error message to webview
 */
export function sendErrorToWebview(
  webview: vscode.Webview,
  message: string,
): void {
  sendToWebview(webview, {
    type: "error",
    message,
  });
}
