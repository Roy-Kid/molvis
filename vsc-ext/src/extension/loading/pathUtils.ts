import * as path from "node:path";
import * as vscode from "vscode";
import { FILE_TYPE_DIRECTORY } from "./zarrDirectoryReaderCore";

export function getDisplayName(uri: vscode.Uri): string {
  return path.basename(uri.fsPath) || "unknown";
}

/**
 * Resolve the "current" file URI for a command that may be invoked from the
 * editor title bar or the explorer context menu. Checks in order:
 *   1. An explicit URI argument (e.g. explorer context menu)
 *   2. The active text editor's document
 *   3. The active tab's input URI (handles custom editors like molvis.editor)
 */
export function resolveActiveUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri) return uri;
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) return activeEditor.document.uri;
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (activeTab?.input instanceof vscode.TabInputCustom)
    return activeTab.input.uri;
  if (activeTab?.input instanceof vscode.TabInputText)
    return activeTab.input.uri;
  return undefined;
}

export function isZarrUriPath(uri: vscode.Uri, type: number): boolean {
  const isDirectory = (type & FILE_TYPE_DIRECTORY) !== 0;
  return (
    isDirectory && (uri.path.endsWith(".zarr") || uri.path.endsWith(".zarr/"))
  );
}
