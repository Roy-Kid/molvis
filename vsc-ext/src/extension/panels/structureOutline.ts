import * as vscode from "vscode";
import type { StructureOutlineNode, StructureOutlinePayload } from "../types";

export type OutlineTreeItem = StructureOutlineNode & {
  /** Flattened atom indices for this node (leaf or aggregate). */
  atomIndices: number[];
};

/** What a tree click selects: explicit rows, or a contiguous run of them. */
export type AtomSelection =
  | { indices: number[]; range?: undefined }
  | { range: { start: number; end: number }; indices?: undefined };

/**
 * Native VS Code tree for one editor surface (Stage or Sketch).
 * Populated from that surface's `structureOutline` messages; click posts
 * `selectAtoms` back via the callback.
 */
export class StructureOutlineProvider
  implements vscode.TreeDataProvider<OutlineTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    OutlineTreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private roots: OutlineTreeItem[] = [];
  /**
   * The webview whose scene this outline describes.
   *
   * Selection has to go back to it. Routing to whichever panel happens to be
   * "active" instead meant a Quick look outline selected atoms in an unrelated
   * Stage tab, or — with no Stage open — did nothing at all.
   */
  private source: vscode.Webview | undefined;

  constructor(
    private readonly selectCommand: string,
    private readonly onSelectAtoms: (
      selection: AtomSelection,
      source: vscode.Webview | undefined,
    ) => void,
    private readonly contextKey: string,
  ) {}

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  setOutline(
    payload: StructureOutlinePayload | null,
    source?: vscode.Webview,
  ): void {
    this.roots = payload ? payload.roots.map((n) => hydrate(n)) : [];
    this.source = payload ? source : undefined;
    void vscode.commands.executeCommand(
      "setContext",
      this.contextKey,
      this.roots.length > 0,
    );
    this._onDidChangeTreeData.fire(undefined);
  }

  clear(): void {
    this.setOutline(null);
  }

  getTreeItem(element: OutlineTreeItem): vscode.TreeItem {
    const collapsible =
      element.children && element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsible);
    item.id = element.id;
    item.contextValue = `molvis.outline.${element.kind}`;
    item.description =
      element.kind === "residue" || element.kind === "chain"
        ? `${element.atomCount} atoms`
        : undefined;
    item.command = {
      command: this.selectCommand,
      title: "Select",
      arguments: [element],
    };
    item.iconPath = iconFor(element.kind);
    return item;
  }

  getChildren(element?: OutlineTreeItem): OutlineTreeItem[] {
    if (!element) return this.roots;
    return (element.children ?? []).map((c) => hydrate(c));
  }

  select(element: OutlineTreeItem): void {
    // A contiguous group travels as its range: the webview expands it there,
    // so selecting a 500 000-atom frame is two numbers, not half a million.
    if (element.atomRange) {
      this.onSelectAtoms({ range: element.atomRange }, this.source);
      return;
    }
    if (element.atomIndices.length === 0) return;
    this.onSelectAtoms({ indices: element.atomIndices }, this.source);
  }
}

function hydrate(node: StructureOutlineNode): OutlineTreeItem {
  const children = node.children?.map(hydrate);
  let atomIndices = node.atomIndices ?? [];
  if (atomIndices.length === 0 && children) {
    atomIndices = children.flatMap((c) => c.atomIndices);
  }
  return { ...node, children, atomIndices };
}

function iconFor(kind: StructureOutlineNode["kind"]): vscode.ThemeIcon {
  switch (kind) {
    case "chain":
      return new vscode.ThemeIcon("type-hierarchy-sub");
    case "residue":
      return new vscode.ThemeIcon("symbol-namespace");
    case "atom":
      return new vscode.ThemeIcon("circle-filled");
    default:
      return new vscode.ThemeIcon("symbol-misc");
  }
}
