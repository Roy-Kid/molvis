import * as vscode from "vscode";
import { createInitMessage } from "../configuration";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import type { Logger, PanelRegistry } from "../types";
import { withErrorHandler } from "./errorBoundary";
import { getPreviewHtml } from "./html";
import {
  handleDropUri,
  handleSaveFile,
  loadTextDocumentToWebview,
  onWebviewMessage,
  sendToWebview,
} from "./messaging";

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
    fileLoader: MolecularFileLoader,
  ): vscode.Disposable {
    const provider = new MolvisEditorProvider(
      context,
      panelRegistry,
      logger,
      fileLoader,
    );
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
    private readonly fileLoader: MolecularFileLoader,
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

    const baseTitle = webviewPanel.title;
    const messageDisposable = onWebviewMessage(
      webviewPanel.webview,
      withErrorHandler(async (message) => {
        switch (message.type) {
          case "ready":
            sendToWebview(webviewPanel.webview, createInitMessage("editor"));
            await loadTextDocumentToWebview(webviewPanel.webview, document);
            break;
          case "saveFile":
            await handleSaveFile(
              message.data,
              message.suggestedName,
              this.logger,
            );
            break;
          case "dropUri":
            await handleDropUri(
              message.uri,
              webviewPanel.webview,
              this.fileLoader,
              this.logger,
            );
            break;
          case "dirtyStateChanged":
            webviewPanel.title = message.isDirty ? `● ${baseTitle}` : baseTitle;
            break;
          case "error":
            this.logger.error(`MolVis: ${message.message}`);
            break;
          default:
            break;
        }
      }, this.logger),
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
  }
}
