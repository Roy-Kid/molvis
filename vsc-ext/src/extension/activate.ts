import * as vscode from "vscode";
import { VsCodeLogger } from "./types";
import { MolvisEditorProvider } from "./panels/editorProvider";
import {
  affectsMolvisSettings,
  createApplySettingsMessage,
} from "./configuration";
import { MolecularFileLoader } from "./loading/molecularFileLoader";
import { createHotReloadWatcher } from "./panels/hotReload";
import { InMemoryPanelRegistry } from "./panels/panelRegistry";
import { sendToWebview } from "./panels/messaging";
import { openQuickViewPanel } from "./panels/previewPanel";
import { openEditorPanel } from "./panels/viewerPanel";

/**
 * Extension entry point. Registers custom editor, preview/viewer commands and hot reload.
 */
export function activate(context: vscode.ExtensionContext): void {
  const panelRegistry = new InMemoryPanelRegistry();
  const logger = new VsCodeLogger();
  const fileLoader = new MolecularFileLoader();

  context.subscriptions.push(
    MolvisEditorProvider.register(context, panelRegistry, logger),
    vscode.commands.registerCommand(
      "molvis.quickView",
      async (uri?: vscode.Uri) => {
        await openQuickViewPanel(context, panelRegistry, logger, fileLoader, uri);
      },
    ),
    vscode.commands.registerCommand("molvis.openEditor", () => {
      openEditorPanel(context, panelRegistry, logger);
    }),
    vscode.commands.registerCommand("molvis.save", async () => {
      await panelRegistry.forEachVisible((panel) => {
        sendToWebview(panel.webview, { type: "triggerSave" });
      });
    }),
    vscode.commands.registerCommand("molvis.reload", async () => {
      await panelRegistry.forEachVisible(async (panel, meta) => {
        if (meta.reload) {
          await meta.reload();
          return;
        }

        panel.webview.html = meta.getHtml();
      });
    }),
    createHotReloadWatcher(context, panelRegistry),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!affectsMolvisSettings(event)) {
        return;
      }

      const message = createApplySettingsMessage();
      await panelRegistry.forEach((panel) => {
        sendToWebview(panel.webview, message);
      });
    }),
  );
}

export function deactivate(): void {}
