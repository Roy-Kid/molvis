import * as vscode from "vscode";

export function getPreviewScriptUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "webview", "index.js"),
  );
}

export function getViewerScriptUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "viewer", "index.js"),
  );
}

export function getViewerCssUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out", "viewer", "index.css"),
  );
}
