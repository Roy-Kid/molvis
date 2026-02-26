import type * as vscode from "vscode";
import { registerOpenPreviewCommand } from "./commands/openPreview";
import { registerOpenViewerCommand } from "./commands/openViewer";
import { registerReloadPanelsCommand } from "./commands/reloadPanels";
import { MolvisEditorProvider } from "./editor/molvisEditorProvider";
import { VsCodeLogger } from "./infra/logger";
import { MolecularFileLoader } from "./loading/molecularFileLoader";
import { createHotReloadWatcher } from "./panels/hotReloadWatcher";
import { InMemoryPanelRegistry } from "./panels/panelRegistry";

/**
 * Extension entry point. Registers custom editor, preview/viewer commands and hot reload.
 */
export function activate(context: vscode.ExtensionContext): void {
  const panelRegistry = new InMemoryPanelRegistry();
  const logger = new VsCodeLogger();
  const fileLoader = new MolecularFileLoader();

  context.subscriptions.push(
    MolvisEditorProvider.register(context, panelRegistry, logger),
    registerOpenPreviewCommand(context, panelRegistry, logger, fileLoader),
    registerOpenViewerCommand(context, panelRegistry),
    registerReloadPanelsCommand(panelRegistry),
    createHotReloadWatcher(context, panelRegistry),
  );
}

export function deactivate(): void {}
