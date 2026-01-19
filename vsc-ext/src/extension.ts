import * as vscode from "vscode";

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

export function activate(context: vscode.ExtensionContext) {
	const helloWorld = vscode.commands.registerCommand("molvis.helloWorld", () => {
		vscode.window.showInformationMessage("Hello World from molvis!");
	});

	const openViewer = vscode.commands.registerCommand("molvis.openViewer", () => {
		const panel = vscode.window.createWebviewPanel(
			"molvis.viewer",
			"Molvis",
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, "out"),
				],
			}
		);

		panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
	});

	context.subscriptions.push(helloWorld, openViewer);
}

export function deactivate() {}

