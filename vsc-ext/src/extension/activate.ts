import * as vscode from "vscode";
import { VsCodeLogger } from "./types";
import { MolvisEditorProvider } from "./panels/editorProvider";
import { MolecularFileLoader } from "./loading/molecularFileLoader";
import { createHotReloadWatcher } from "./panels/hotReload";
import { InMemoryPanelRegistry } from "./panels/panelRegistry";
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
      openEditorPanel(context, panelRegistry);
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
  );
}

export function deactivate(): void {}
