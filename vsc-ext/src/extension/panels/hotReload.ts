import * as vscode from "vscode";
import type { PanelRegistry } from "../types";

export function createHotReloadWatcher(
  context: vscode.ExtensionContext,
  panelRegistry: PanelRegistry,
): vscode.Disposable {
  const outPattern = new vscode.RelativePattern(
    vscode.Uri.joinPath(context.extensionUri, "out"),
    "**/*.{js,css}",
  );
  const watcher = vscode.workspace.createFileSystemWatcher(outPattern);
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleReload = () => {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
    }

    reloadTimer = setTimeout(() => {
      // biome-ignore lint/complexity/noForEach: panelRegistry.forEach is a custom async iterator
      void panelRegistry.forEach((panel, meta) => {
        panel.webview.html = meta.getHtml();
      });
    }, 300);
  };

  watcher.onDidChange(scheduleReload);
  watcher.onDidCreate(scheduleReload);

  return watcher;
}
