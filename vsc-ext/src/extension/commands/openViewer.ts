import * as vscode from "vscode";
import { openViewerPanel } from "../panels/viewerPanelController";
import type { PanelRegistry } from "../types/panel";

export function registerOpenViewerCommand(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
): vscode.Disposable {
  return vscode.commands.registerCommand("molvis.openViewer", () => {
    openViewerPanel(context, panelRegistry);
  });
}
