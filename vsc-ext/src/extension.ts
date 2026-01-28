import * as vscode from "vscode";
import { MolvisEditorProvider } from "./customEditor";
import { sendToWebview } from "./webviewMessaging";

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
	// Register Custom Text Editor Provider for .pdb files
	context.subscriptions.push(MolvisEditorProvider.register(context));

	// Command: Hello World (for testing)
	const helloWorld = vscode.commands.registerCommand("molvis.helloWorld", () => {
		vscode.window.showInformationMessage("Hello World from molvis!");
	});

	// Command: Open standalone viewer
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

		// Send init message for standalone mode
		sendToWebview(panel.webview, { type: "init", mode: "standalone" });
	});

	// Command: Open preview to the side
	const openPreviewToSide = vscode.commands.registerCommand(
		"molvis.openPreviewToSide",
		async () => {
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				return;
			}

			const document = activeEditor.document;
			const lowerName = document.fileName.toLowerCase();
			if (!lowerName.endsWith(".pdb") && !lowerName.endsWith(".xyz")) {
				vscode.window.showWarningMessage(
					"MolVis preview is only available for .pdb or .xyz files"
				);
				return;
			}

			// Open the file in Custom Editor in a split view
			await vscode.commands.executeCommand(
				"vscode.openWith",
				document.uri,
				"molvis.editor",
				vscode.ViewColumn.Beside
			);
		}
	);

	// Command: Open Full App
	const openApp = vscode.commands.registerCommand("molvis.openApp", () => {
		const panel = vscode.window.createWebviewPanel(
			"molvis.app",
			"MolVis App",
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, "out"),
					// Allow access to page dist if we can find it (dev mode hack or strictly strictly packaged)
					// For now, we reuse the existing webview but tell it to be "app" mode
				],
			}
		);

		panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

		// Send init message for app mode
		// The webview wrapper needs to handle 'app' mode by rendering the full UI
		sendToWebview(panel.webview, { type: "init", mode: "app" });
	});

	context.subscriptions.push(helloWorld, openViewer, openPreviewToSide, openApp);
}

export function deactivate() { }
