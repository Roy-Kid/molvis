import * as path from "node:path";
import * as vscode from "vscode";
import { IgnoreStack } from "../loading/gitignore";
import {
  IGNORED_DIRECTORY_NAMES,
  isMolecularPath,
  isSketchPath,
  workspaceMolecularIncludeGlob,
} from "../loading/molecularMatch";
import { mrecStoreRootPath } from "../loading/pathUtils";
import type { RecentFilesStore } from "../loading/recentFiles";

/**
 * Activity-bar Files tree: Recent + workspace molecular files.
 * Click opens Stage, or Sketch for MOL/SDF. Quick look is a context action.
 */

export type FilesNode =
  | { kind: "section"; id: "recent" | "workspace" }
  /**
   * A real directory, read only when the user opens it. `ignores` is the
   * `.gitignore` state inherited down to here, carried on the node so
   * descending never re-reads an ancestor.
   */
  | { kind: "dir"; uri: vscode.Uri; label: string; ignores: IgnoreStack }
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

const REFRESH_DEBOUNCE_MS = 200;

/**
 * A directory read that came back with this many entries or more is reported
 * truncated rather than rendered whole. A tree row the user did not ask for
 * costs nothing to skip and a great deal to draw ten thousand of.
 */
const DIR_ENTRY_CAP = 2000;

export class MolvisFilesViewProvider
  implements vscode.TreeDataProvider<FilesNode>, vscode.Disposable
{
  public static readonly viewType = "molvis.files";

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    FilesNode | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly recentFiles: RecentFilesStore) {
    this.disposables.push(this.recentFiles.onDidChange(() => this.refresh()));
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.queueRefresh()),
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      workspaceMolecularIncludeGlob(),
    );
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

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  queueRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), REFRESH_DEBOUNCE_MS);
  }

  /** Kept for the `molvis.refreshFiles` command; the tree holds no scan to redo. */
  async refreshWorkspace(): Promise<void> {
    this.refresh();
  }

  getTreeItem(element: FilesNode): vscode.TreeItem {
    if (element.kind === "section") {
      const item = new vscode.TreeItem(
        element.id === "recent" ? "Recent" : "Workspace",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = `section:${element.id}`;
      item.iconPath = new vscode.ThemeIcon(
        element.id === "recent" ? "history" : "root-folder",
      );
      if (element.id === "recent") {
        item.description = String(this.recentFiles.list().length);
      }
      item.contextValue = `molvis.section.${element.id}`;
      return item;
    }

    if (element.kind === "dir") {
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.id = `dir:${element.uri.toString()}`;
      item.resourceUri = element.uri;
      item.iconPath = vscode.ThemeIcon.Folder;
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

  /**
   * One directory read per expanded node — never a walk.
   *
   * The tree used to scan the whole workspace before it could draw its first
   * row, which on a large tree meant it never drew one. Nothing here looks
   * below the node it was asked about, so opening the view costs one
   * `readDirectory` of the workspace root and each disclosure triangle costs
   * exactly one more.
   */
  async getChildren(element?: FilesNode): Promise<FilesNode[]> {
    if (!element) {
      const nodes: FilesNode[] = [];
      if (this.recentFiles.list().length > 0) {
        nodes.push({ kind: "section", id: "recent" });
      }
      if ((vscode.workspace.workspaceFolders ?? []).length > 0) {
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
      const folders = vscode.workspace.workspaceFolders ?? [];
      if (folders.length === 1) {
        return this.readDir(folders[0].uri, IgnoreStack.empty(), "");
      }
      return Promise.all(
        folders.map(async (folder) => ({
          kind: "dir" as const,
          uri: folder.uri,
          label: folder.name,
          ignores: IgnoreStack.empty(),
        })),
      );
    }

    if (element.kind === "dir") {
      return this.readDir(
        element.uri,
        element.ignores,
        workspaceRelativePath(element.uri),
      );
    }

    return [];
  }

  dispose(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    for (const d of this.disposables) d.dispose();
    this._onDidChangeTreeData.dispose();
  }

  /**
   * The children of one directory: sub-directories worth opening, and the
   * molecular files sitting in it.
   *
   * `.gitignore` is honoured on top of the built-in list — a generated tree
   * the user already told git to forget has no business in a file picker —
   * and the directory's own `.gitignore` joins the inherited rules before
   * anything here is judged by them.
   */
  private async readDir(
    dir: vscode.Uri,
    inherited: IgnoreStack,
    dirRel: string,
  ): Promise<FilesNode[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      // An unreadable directory is a row that shows nothing, not a broken tree.
      return [];
    }

    const ignores = await this.withGitignore(dir, inherited, dirRel, entries);
    const dirs: FilesNode[] = [];
    const files: FilesNode[] = [];

    for (const [name, type] of entries.slice(0, DIR_ENTRY_CAP)) {
      const uri = vscode.Uri.joinPath(dir, name);
      const rel = dirRel ? `${dirRel}/${name}` : name;
      const isDir = (type & vscode.FileType.Directory) !== 0;

      if (isDir) {
        // An `*.mrec` store is a directory on disk and a single record to
        // open; it is a leaf here, never something to walk into.
        if (mrecStoreRootPath(name)) {
          files.push({ kind: "file", uri, source: "workspace" });
          continue;
        }
        if (IGNORED_DIRECTORY_NAMES.has(name)) continue;
        if (ignores.ignores(rel, true)) continue;
        dirs.push({ kind: "dir", uri, label: name, ignores });
        continue;
      }

      if (!isMolecularPath(name)) continue;
      if (ignores.ignores(rel, false)) continue;
      files.push({ kind: "file", uri, source: "workspace" });
    }

    const byName = (a: FilesNode, b: FilesNode) =>
      nodeLabel(a).localeCompare(nodeLabel(b));
    dirs.sort(byName);
    files.sort(byName);
    return [...dirs, ...files];
  }

  /** `inherited` plus this directory's own `.gitignore`, when it has one. */
  private async withGitignore(
    dir: vscode.Uri,
    inherited: IgnoreStack,
    dirRel: string,
    entries: readonly [string, vscode.FileType][],
  ): Promise<IgnoreStack> {
    const has = entries.some(
      ([name, type]) =>
        name === ".gitignore" && (type & vscode.FileType.File) !== 0,
    );
    if (!has) return inherited;
    try {
      const bytes = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(dir, ".gitignore"),
      );
      return inherited.extend(dirRel, new TextDecoder().decode(bytes));
    } catch {
      return inherited;
    }
  }
}

function nodeLabel(node: FilesNode): string {
  if (node.kind === "dir") return node.label;
  if (node.kind === "file") return path.basename(node.uri.fsPath);
  return "";
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
