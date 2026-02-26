import * as vscode from "vscode";
import type { Logger } from "../infra/logger";
import type { MolecularFileLoader } from "../loading/molecularFileLoader";
import { openPreviewPanel } from "../panels/previewPanelController";
import type { PanelRegistry } from "../types/panel";

export function registerOpenPreviewCommand(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
  logger: Logger,
  fileLoader: MolecularFileLoader,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "molvis.openPreview",
    async (uri?: vscode.Uri) => {
      await openPreviewPanel(context, panelRegistry, logger, fileLoader, uri);
    },
  );
}
