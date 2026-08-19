import * as path from "node:path";
import * as vscode from "vscode";
import { groupPathsByParent } from "../loading/filesTree";
import {
  isMolecularPath,
  isSketchPath,
  WORKSPACE_FILE_EXCLUDE,
  workspaceMolecularIncludeGlobs,
} from "../loading/molecularMatch";
import type { RecentFilesStore } from "../loading/recentFiles";

/**
 * Activity-bar Files tree: Recent + workspace molecular files.
 * Click opens Stage, or Sketch for MOL/SDF. Quick View is a context action.
 */

export type FilesNode =
  | { kind: "section"; id: "recent" | "workspace" }
  | { kind: "folder"; folder: string }
  | { kind: "file"; uri: vscode.Uri; source: "recent" | "workspace" };

/**
 * Resolve a URI from a tree click or context-menu invocation.
 * Tree item `command.arguments` pass a {@link vscode.Uri}; view context
 * menus pass the {@link FilesNode} element (or a TreeItem with
 * `resourceUri`).
 */
export function uriFromFilesArg(arg: unknown): vscode.Uri | undefined {
  if (!arg) return undefined;
  if (arg instanceof vscode.Uri) return arg;
  if (typeof arg === "object" && arg !== null) {
    const node = arg as Partial<FilesNode> & {
      resourceUri?: vscode.Uri;
      uri?: vscode.Uri;
    };
    if (node.kind === "file" && node.uri instanceof vscode.Uri) {
      return node.uri;
    }
    if (node.resourceUri instanceof vscode.Uri) {
      return node.resourceUri;
    }
    if (node.uri instanceof vscode.Uri) {
      return node.uri;
    }
  }
  return undefined;
}

const SCAN_CAP_PER_GLOB = 400;
const REFRESH_DEBOUNCE_MS = 200;

export class MolvisFilesViewProvider
  implements vscode.TreeDataProvider<FilesNode>, vscode.Disposable
{
  public static readonly viewType = "molvis.files";

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    FilesNode | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly disposables: vscode.Disposable[] = [];
  private workspaceUris: vscode.Uri[] = [];
  private scanned = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly recentFiles: RecentFilesStore) {
    this.disposables.push(this.recentFiles.onDidChange(() => this.refresh()));
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.queueRefresh()),
    );
    for (const glob of workspaceMolecularIncludeGlobs()) {
      const watcher = vscode.workspace.createFileSystemWatcher(glob);
      this.disposables.push(
        watcher,
        watcher.onDidCreate((uri) => {
          if (isMolecularPath(uri.fsPath)) this.queueRefresh();
        }),
        watcher.onDidDelete((uri) => {
          if (isMolecularPath(uri.fsPath)) this.queueRefresh();
        }),
      );
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  queueRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      void this.refreshWorkspace();
    }, REFRESH_DEBOUNCE_MS);
  }

  async refreshWorkspace(): Promise<void> {
    await this.scanWorkspace();
    this.refresh();
  }

  getTreeItem(element: FilesNode): vscode.TreeItem {
    if (element.kind === "section") {
      const count =
        element.id === "recent"
          ? this.recentFiles.list().length
          : this.workspaceUris.length;
      const item = new vscode.TreeItem(
        element.id === "recent" ? "Recent" : "Workspace",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = `section:${element.id}`;
      item.iconPath = new vscode.ThemeIcon(
        element.id === "recent" ? "history" : "root-folder",
      );
      item.description = String(count);
      item.contextValue = `molvis.section.${element.id}`;
      return item;
    }

    if (element.kind === "folder") {
      const item = new vscode.TreeItem(
        element.folder,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = `folder:${element.folder}`;
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "molvis.folder";
      return item;
    }

    const name = path.basename(element.uri.fsPath) || element.uri.path;
    const item = new vscode.TreeItem(
      name,
      vscode.TreeItemCollapsibleState.None,
    );
    item.iconPath = new vscode.ThemeIcon("file");
    item.resourceUri = element.uri;
    item.tooltip = element.uri.fsPath || element.uri.toString(true);
    const sketch = isSketchPath(element.uri.fsPath);
    item.contextValue = [
      "molvis.file",
      element.source === "recent" ? "recent" : undefined,
      sketch ? "sketch" : undefined,
    ]
      .filter(Boolean)
      .join(".");
    item.id = `${element.source}:${element.uri.toString()}`;
    if (element.source === "recent") {
      item.description = workspaceRelativeDir(element.uri);
    }
    item.command = {
      command: sketch ? "molvis.openSketch" : "molvis.openStage",
      title: sketch ? "Open Sketch" : "Open Stage",
      arguments: [element.uri],
    };
    return item;
  }

  async getChildren(element?: FilesNode): Promise<FilesNode[]> {
    if (!this.scanned) {
      await this.scanWorkspace();
    }

    if (!element) {
      const nodes: FilesNode[] = [];
      if (this.recentFiles.list().length > 0) {
        nodes.push({ kind: "section", id: "recent" });
      }
      if (this.workspaceUris.length > 0) {
        nodes.push({ kind: "section", id: "workspace" });
      }
      return nodes;
    }

    if (element.kind === "section" && element.id === "recent") {
      return this.recentFiles
        .list()
        .map((uri) => ({ kind: "file" as const, uri, source: "recent" }));
    }

    if (element.kind === "section" && element.id === "workspace") {
      return this.workspaceChildren();
    }

    if (element.kind === "folder") {
      const relToUri = this.workspaceRelMap();
      const group = groupPathsByParent([...relToUri.keys()]).find(
        (g) => g.folder === element.folder,
      );
      if (!group) return [];
      return group.paths.flatMap((rel) => {
        const uri = relToUri.get(rel);
        return uri
          ? [{ kind: "file" as const, uri, source: "workspace" as const }]
          : [];
      });
    }

    return [];
  }

  dispose(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    for (const d of this.disposables) d.dispose();
    this._onDidChangeTreeData.dispose();
  }

  private async scanWorkspace(): Promise<void> {
    const found: vscode.Uri[] = [];
    const seen = new Set<string>();
    for (const glob of workspaceMolecularIncludeGlobs()) {
      const batch = await vscode.workspace.findFiles(
        glob,
        WORKSPACE_FILE_EXCLUDE,
        SCAN_CAP_PER_GLOB,
      );
      for (const uri of batch) {
        const key = uri.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(uri);
      }
    }
    this.workspaceUris = found.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    this.scanned = true;
  }

  private workspaceRelMap(): Map<string, vscode.Uri> {
    const map = new Map<string, vscode.Uri>();
    for (const uri of this.workspaceUris) {
      map.set(workspaceRelativePath(uri), uri);
    }
    return map;
  }

  private workspaceChildren(): FilesNode[] {
    const relToUri = this.workspaceRelMap();
    const groups = groupPathsByParent([...relToUri.keys()]);
    const only = groups.length === 1 ? groups[0] : undefined;
    if (only?.folder === ".") {
      return only.paths.flatMap((rel) => {
        const uri = relToUri.get(rel);
        return uri
          ? [{ kind: "file" as const, uri, source: "workspace" as const }]
          : [];
      });
    }
    return groups.map((g) => ({ kind: "folder" as const, folder: g.folder }));
  }
}

function workspaceRelativePath(uri: vscode.Uri): string {
  const folders = vscode.workspace.workspaceFolders;
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath.replaceAll("\\", "/");
  const rel = path
    .relative(folder.uri.fsPath, uri.fsPath)
    .replaceAll("\\", "/");
  if (folders && folders.length > 1) {
    return rel ? `${folder.name}/${rel}` : folder.name;
  }
  return rel || path.basename(uri.fsPath);
}

function workspaceRelativeDir(uri: vscode.Uri): string {
  const rel = workspaceRelativePath(uri);
  const slash = rel.lastIndexOf("/");
  return slash <= 0 ? "." : rel.slice(0, slash);
}
