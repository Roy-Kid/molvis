import * as vscode from "vscode";
import {
  affectsMolvisSettings,
  createApplySettingsMessage,
} from "./configuration";
import { resolveActiveUri } from "./loading/activeUri";
import { MolecularFileLoader } from "./loading/molecularFileLoader";
import { pickMolecularUri } from "./loading/openStructure";
import { RecentFilesStore } from "./loading/recentFiles";
import { MolvisBinaryEditorProvider } from "./panels/binaryEditorProvider";
import { MolvisEditorProvider } from "./panels/editorProvider";
import { createHotReloadWatcher } from "./panels/hotReload";
import {
  MolvisLauncherViewProvider,
  uriFromLauncherArg,
} from "./panels/launcherView";
import { sendLoadedFile, sendToWebview } from "./panels/messaging";
import { InMemoryPanelRegistry } from "./panels/panelRegistry";
import { openQuickViewPanel } from "./panels/previewPanel";
import { MolvisSketchViewProvider } from "./panels/sketchView";
import {
  type OutlineTreeItem,
  StructureOutlineProvider,
} from "./panels/structureOutline";
import { openEditorPanel } from "./panels/viewerPanel";
import type { PanelHandle, StructureOutlinePayload } from "./types";
import { VsCodeLogger } from "./types";

const DOCS_URL = "https://docs.molcrafts.org/molvis/interfaces/vscode/";

/** Molecular extensions eligible for explorer → workspace auto-load. */
const MOLECULAR_EXT = new Set([
  ".pdb",
  ".ent",
  ".brk",
  ".xyz",
  ".extxyz",
  ".exyz",
  ".cif",
  ".mmcif",
  ".data",
  ".lmp",
  ".lammps",
  ".lammpsdata",
  ".dump",
  ".lammpstrj",
  ".lmptrj",
  ".lammpsdump",
  ".sdf",
  ".mol",
  ".cube",
  ".cub",
  ".chgcar",
  ".gro",
  ".mol2",
  ".poscar",
  ".contcar",
  ".vasp",
  ".dcd",
  ".trr",
  ".xtc",
  ".zarr",
]);

let activePanelRegistry: InMemoryPanelRegistry | undefined;

/**
 * Extension entry point. Registers custom editor, preview/viewer commands,
 * activity-bar launcher, structure outline, and hot reload.
 */
export function activate(context: vscode.ExtensionContext): void {
  const panelRegistry = new InMemoryPanelRegistry();
  activePanelRegistry = panelRegistry;
  const logger = new VsCodeLogger();
  const fileLoader = new MolecularFileLoader();
  const recentFiles = new RecentFilesStore(context.globalState);
  const launcher = new MolvisLauncherViewProvider(recentFiles);

  /** Last-focused workspace webview (for outline + explorer load). */
  let activeWorkspace: PanelHandle | undefined;

  const outline = new StructureOutlineProvider((indices) => {
    if (!activeWorkspace) return;
    sendToWebview(activeWorkspace.webview, {
      type: "selectAtoms",
      indices,
    });
  });

  const setOutline = (payload: StructureOutlinePayload | null): void => {
    outline.setOutline(payload);
  };

  const recordRecent = (uri: vscode.Uri | undefined): void => {
    if (!uri) return;
    void recentFiles.add(uri);
  };

  const openWorkspace = (uri?: vscode.Uri): void => {
    const panel = openEditorPanel(
      context,
      panelRegistry,
      logger,
      fileLoader,
      uri,
      { onStructureOutline: setOutline },
    );
    activeWorkspace = panel;
    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) activeWorkspace = e.webviewPanel;
    });
    panel.onDidDispose(() => {
      if (activeWorkspace === panel) {
        activeWorkspace = undefined;
        outline.clear();
      }
    });
  };

  /** Load a file into an open workspace, or open a new workspace with it. */
  const loadIntoWorkspace = async (uri: vscode.Uri): Promise<void> => {
    recordRecent(uri);
    if (activeWorkspace) {
      await sendLoadedFile(activeWorkspace.webview, uri, fileLoader, logger);
      return;
    }
    // Prefer any registered workspace panel that is still alive.
    let found: PanelHandle | undefined;
    await panelRegistry.forEach((panel, meta) => {
      if (meta.viewType === "molvis.workspace" || !found) {
        found = panel;
      }
    });
    if (found) {
      activeWorkspace = found;
      await sendLoadedFile(found.webview, uri, fileLoader, logger);
      return;
    }
    openWorkspace(uri);
  };

  context.subscriptions.push(
    logger,
    recentFiles,
    launcher,
    outline,
    MolvisEditorProvider.register(
      context,
      panelRegistry,
      logger,
      fileLoader,
      recentFiles,
    ),
    MolvisBinaryEditorProvider.register(
      context,
      panelRegistry,
      logger,
      fileLoader,
      recentFiles,
    ),
    // Activity-bar: native tree launcher (Actions / Recent / Help). No WebGL.
    vscode.window.createTreeView(MolvisLauncherViewProvider.viewType, {
      treeDataProvider: launcher,
      showCollapseAll: false,
    }),
    // Structure Outline — chain/residue/atom tree driven by the webview.
    vscode.window.createTreeView("molvis.outline", {
      treeDataProvider: outline,
      showCollapseAll: true,
    }),
    vscode.window.registerWebviewViewProvider(
      MolvisSketchViewProvider.viewType,
      new MolvisSketchViewProvider(context, panelRegistry, logger),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand(
      "molvis.outline.select",
      (item?: OutlineTreeItem) => {
        if (item) outline.select(item);
      },
    ),
    vscode.commands.registerCommand(
      "molvis.quickView",
      async (arg?: unknown) => {
        // Tree context menus pass a LauncherNode; explorer/commands pass a Uri.
        const target = uriFromLauncherArg(arg) ?? resolveActiveUri();
        recordRecent(target);
        await openQuickViewPanel(
          context,
          panelRegistry,
          logger,
          fileLoader,
          target,
        );
      },
    ),
    vscode.commands.registerCommand("molvis.openEditor", (arg?: unknown) => {
      try {
        // Launcher "Open Workspace" has no URI; explorer may pass one.
        // Never require an active file — empty workspace editor is valid.
        const target = uriFromLauncherArg(arg) ?? resolveActiveUri();
        recordRecent(target);
        openWorkspace(target);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        logger.error(`MolVis: Open Workspace failed: ${text}`);
      }
    }),
    vscode.commands.registerCommand(
      "molvis.loadInWorkspace",
      async (arg?: unknown) => {
        const target = uriFromLauncherArg(arg) ?? resolveActiveUri();
        if (!target) return;
        await loadIntoWorkspace(target);
      },
    ),
    vscode.commands.registerCommand("molvis.openStructure", async () => {
      const picked = await pickMolecularUri();
      if (!picked) return;
      await loadIntoWorkspace(picked);
    }),
    vscode.commands.registerCommand(
      "molvis.openRecentInWorkspace",
      (arg?: unknown) => {
        const target = uriFromLauncherArg(arg);
        if (!target) return;
        void loadIntoWorkspace(target);
      },
    ),
    vscode.commands.registerCommand(
      "molvis.removeRecent",
      async (arg?: unknown) => {
        const target = uriFromLauncherArg(arg);
        if (!target) return;
        await recentFiles.remove(target);
      },
    ),
    vscode.commands.registerCommand("molvis.clearRecent", async () => {
      await recentFiles.clear();
    }),
    vscode.commands.registerCommand("molvis.openDocs", async () => {
      await vscode.env.openExternal(vscode.Uri.parse(DOCS_URL));
    }),
    vscode.commands.registerCommand("molvis.showOutput", () => {
      logger.show();
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
    ...(context.extensionMode !== vscode.ExtensionMode.Production
      ? [
          vscode.commands.registerCommand(
            "molvis._test.getRegisteredPanelViewTypes",
            () => panelRegistry.getRegisteredViewTypes(),
          ),
        ]
      : []),
    ...(context.extensionMode !== vscode.ExtensionMode.Production
      ? [createHotReloadWatcher(context, panelRegistry)]
      : []),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!affectsMolvisSettings(event)) {
        return;
      }

      const message = createApplySettingsMessage();
      // biome-ignore lint/complexity/noForEach: panelRegistry.forEach is a custom async iterator, not Array.forEach
      await panelRegistry.forEach((panel) => {
        sendToWebview(panel.webview, message);
      });
    }),
    // Explorer auto-load: when a molecular text document opens and a
    // workspace panel already exists, load into that panel (don't leave
    // the user staring at raw PDB text next to an empty viewer).
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.uri.scheme !== "file") return;
      const ext = doc.uri.path.includes(".")
        ? doc.uri.path.slice(doc.uri.path.lastIndexOf(".")).toLowerCase()
        : "";
      const base = doc.uri.path.split("/").pop()?.toUpperCase() ?? "";
      const isMolecular =
        MOLECULAR_EXT.has(ext) ||
        base === "CHGCAR" ||
        base === "POSCAR" ||
        base === "CONTCAR";
      if (!isMolecular) return;
      if (!activeWorkspace) return;
      void sendLoadedFile(activeWorkspace.webview, doc.uri, fileLoader, logger);
    }),
  );
}

export function getRegisteredPanelViewTypesForTests(): readonly string[] {
  return activePanelRegistry?.getRegisteredViewTypes() ?? [];
}

export function deactivate(): void {}
