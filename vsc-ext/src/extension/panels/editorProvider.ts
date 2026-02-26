import * as vscode from "vscode";
import type { Logger, PanelRegistry } from "../types";
import {
  handleSaveFile,
  loadTextDocumentToWebview,
  onWebviewMessage,
  sendToWebview,
} from "./messaging";
import { getPreviewHtml } from "./html";

/**
 * Custom text editor provider for molecular text formats (`.pdb/.xyz/.data`).
 * Keeps the webview in sync with the currently opened text document.
 */
export class MolvisEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "molvis.editor";

  public static register(
    context: vscode.ExtensionContext,
    panelRegistry: PanelRegistry,
    logger: Logger,
  ): vscode.Disposable {
    const provider = new MolvisEditorProvider(context, panelRegistry, logger);
    return vscode.window.registerCustomEditorProvider(
      MolvisEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    );
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panelRegistry: PanelRegistry,
    private readonly logger: Logger,
  ) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    };
    webviewPanel.webview.html = getPreviewHtml(
      webviewPanel.webview,
      this.context.extensionUri,
    );

    const messageDisposable = onWebviewMessage(
      webviewPanel.webview,
      (message) => {
        switch (message.type) {
          case "ready":
            void loadTextDocumentToWebview(webviewPanel.webview, document);
            break;
          case "saveFile":
            void handleSaveFile(message.data, message.suggestedName);
            break;
          case "error":
            this.logger.error(`MolVis: ${message.message}`);
            break;
          default:
            break;
        }
      },
    );

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          void loadTextDocumentToWebview(webviewPanel.webview, document);
        }
      },
    );

    this.panelRegistry.register(webviewPanel, {
      getHtml: () =>
        getPreviewHtml(webviewPanel.webview, this.context.extensionUri),
      reload: async () => {
        await loadTextDocumentToWebview(webviewPanel.webview, document);
      },
    });

    webviewPanel.onDidDispose(() => {
      this.panelRegistry.unregister(webviewPanel);
      messageDisposable.dispose();
      changeDocumentSubscription.dispose();
    });

    sendToWebview(webviewPanel.webview, {
      type: "init",
      mode: "editor",
      config: { showUI: true },
    });
  }
}
