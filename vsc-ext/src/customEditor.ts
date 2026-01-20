import * as vscode from "vscode";
import { loadFileToWebview, onWebviewMessage, sendToWebview } from "./webviewMessaging";

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "out", "webview", "index.js")
    );

    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'`,
        `connect-src ${webview.cspSource} https:`,
        `font-src ${webview.cspSource} https: data:`,
    ].join("; ");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Molvis</title>
    <style>
      html, body, #molvis-container { position: absolute; inset: 0; margin: 0; padding: 0; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div id="molvis-container"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

/**
 * Custom Text Editor Provider for .pdb files
 */
export class MolvisEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new MolvisEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            MolvisEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            }
        );
        return providerRegistration;
    }

    private static readonly viewType = "molvis.editor";

    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Called when custom editor is opened
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Configure webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "out"),
            ],
        };

        webviewPanel.webview.html = getWebviewHtml(
            webviewPanel.webview,
            this.context.extensionUri
        );

        // Set up message handling
        const messageDisposable = onWebviewMessage(webviewPanel.webview, (message) => {
            switch (message.type) {
                case "ready":
                    // Webview is ready, send initial file content
                    loadFileToWebview(webviewPanel.webview, document);
                    break;
                case "error":
                    vscode.window.showErrorMessage(`MolVis: ${message.message}`);
                    break;
            }
        });

        // Listen for document changes and sync to webview
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                loadFileToWebview(webviewPanel.webview, document);
            }
        });

        // Clean up when webview is disposed
        webviewPanel.onDidDispose(() => {
            messageDisposable.dispose();
            changeDocumentSubscription.dispose();
        });

        // Send init message
        sendToWebview(webviewPanel.webview, { type: "init", mode: "editor" });
    }
}
