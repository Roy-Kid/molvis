import * as vscode from "vscode";
import {
  affectsMolvisSettings,
  createApplySettingsMessage,
} from "./configuration";
import { resolveActiveUri } from "./loading/activeUri";
import { MolecularFileLoader } from "./loading/molecularFileLoader";
import { isMolecularPath, isSketchPath } from "./loading/molecularMatch";
import { pickMolecularUri } from "./loading/openStructure";
import { RecentFilesStore } from "./loading/recentFiles";
import { MolvisBinaryEditorProvider } from "./panels/binaryEditorProvider";
import { MolvisEditorProvider } from "./panels/editorProvider";
import { MolvisFilesViewProvider, uriFromFilesArg } from "./panels/filesView";
import { createHotReloadWatcher } from "./panels/hotReload";
import { sendLoadedFile, sendToWebview } from "./panels/messaging";
import { openPagePanel } from "./panels/pagePanel";
import { InMemoryPanelRegistry } from "./panels/panelRegistry";
import { openQuickViewPanel } from "./panels/previewPanel";
import { openSketchPanel } from "./panels/sketchPanel";
import { openSketchQuickViewPanel } from "./panels/sketchQuickViewPanel";
import { openStagePanel } from "./panels/stagePanel";
import {
  type OutlineTreeItem,
  StructureOutlineProvider,
} from "./panels/structureOutline";
import { VsCodeLogger } from "./types";

const DOCS_URL = "https://docs.molcrafts.org/molvis/interfaces/vscode/";

let activePanelRegistry: InMemoryPanelRegistry | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const panelRegistry = new InMemoryPanelRegistry();
  activePanelRegistry = panelRegistry;
  const logger = new VsCodeLogger();
  const fileLoader = new MolecularFileLoader();
  const recentFiles = new RecentFilesStore(context.globalState);
  const files = new MolvisFilesViewProvider(recentFiles);

  let activeStage: vscode.WebviewPanel | undefined;
  let activeSketch: vscode.WebviewPanel | undefined;

  const stageOutline = new StructureOutlineProvider(
    "molvis.stageOutline.select",
    (indices) => {
      if (!activeStage) return;
      sendToWebview(activeStage.webview, { type: "selectAtoms", indices });
    },
    "molvis.hasStageOutline",
  );
  const sketchOutline = new StructureOutlineProvider(
    "molvis.sketchOutline.select",
    (indices) => {
      if (!activeSketch) return;
      sendToWebview(activeSketch.webview, { type: "selectAtoms", indices });
    },
    "molvis.hasSketchOutline",
  );

  const recordRecent = (uri: vscode.Uri | undefined): void => {
    if (!uri) return;
    void recentFiles.add(uri);
  };

  const openStage = (uri?: vscode.Uri): vscode.WebviewPanel => {
    if (activeStage) {
      if (uri) {
        void sendLoadedFile(activeStage.webview, uri, fileLoader, logger);
      }
      activeStage.reveal(
        activeStage.viewColumn ?? vscode.ViewColumn.One,
        false,
      );
      return activeStage;
    }
    const panel = openStagePanel(
      context,
      panelRegistry,
      logger,
      fileLoader,
      uri,
      {
        onStructureOutline: (payload) => stageOutline.setOutline(payload),
      },
    );
    activeStage = panel;
    panel.onDidDispose(() => {
      if (activeStage === panel) {
        activeStage = undefined;
        stageOutline.clear();
      }
    });
    return panel;
  };

  const openSketch = (uri?: vscode.Uri): vscode.WebviewPanel => {
    if (activeSketch) {
      if (uri) {
        void sendLoadedFile(activeSketch.webview, uri, fileLoader, logger);
      }
      activeSketch.reveal(
        activeSketch.viewColumn ?? vscode.ViewColumn.One,
        false,
      );
      return activeSketch;
    }
    const panel = openSketchPanel(
      context,
      panelRegistry,
      logger,
      fileLoader,
      uri,
      {
        onStructureOutline: (payload) => sketchOutline.setOutline(payload),
      },
    );
    activeSketch = panel;
    panel.onDidDispose(() => {
      if (activeSketch === panel) {
        activeSketch = undefined;
        sketchOutline.clear();
      }
    });
    return panel;
  };

  const loadIntoStage = async (uri: vscode.Uri): Promise<void> => {
    recordRecent(uri);
    if (activeStage) {
      await sendLoadedFile(activeStage.webview, uri, fileLoader, logger);
      activeStage.reveal(
        activeStage.viewColumn ?? vscode.ViewColumn.One,
        false,
      );
      return;
    }
    openStage(uri);
  };

  const loadIntoSketch = async (uri: vscode.Uri): Promise<void> => {
    recordRecent(uri);
    if (activeSketch) {
      await sendLoadedFile(activeSketch.webview, uri, fileLoader, logger);
      activeSketch.reveal(
        activeSketch.viewColumn ?? vscode.ViewColumn.One,
        false,
      );
      return;
    }
    openSketch(uri);
  };

  context.subscriptions.push(
    logger,
    recentFiles,
    files,
    stageOutline,
    sketchOutline,
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
    vscode.window.createTreeView(MolvisFilesViewProvider.viewType, {
      treeDataProvider: files,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView("molvis.stageOutline", {
      treeDataProvider: stageOutline,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView("molvis.sketchOutline", {
      treeDataProvider: sketchOutline,
      showCollapseAll: true,
    }),
    vscode.commands.registerCommand(
      "molvis.stageOutline.select",
      (item?: OutlineTreeItem) => {
        if (item) stageOutline.select(item);
      },
    ),
    vscode.commands.registerCommand(
      "molvis.sketchOutline.select",
      (item?: OutlineTreeItem) => {
        if (item) sketchOutline.select(item);
      },
    ),
    vscode.commands.registerCommand(
      "molvis.quickView",
      async (arg?: unknown) => {
        const target = uriFromFilesArg(arg) ?? resolveActiveUri();
        recordRecent(target);
        await openQuickViewPanel(
          context,
          panelRegistry,
          logger,
          fileLoader,
          target,
          {
            onStructureOutline: (payload) => stageOutline.setOutline(payload),
          },
        );
      },
    ),
    vscode.commands.registerCommand(
      "molvis.quickViewSketch",
      async (arg?: unknown) => {
        const target = uriFromFilesArg(arg) ?? resolveActiveUri();
        recordRecent(target);
        await openSketchQuickViewPanel(
          context,
          panelRegistry,
          logger,
          fileLoader,
          target,
          {
            onStructureOutline: (payload) => sketchOutline.setOutline(payload),
          },
        );
      },
    ),
    vscode.commands.registerCommand("molvis.openStage", (arg?: unknown) => {
      try {
        const target = uriFromFilesArg(arg) ?? resolveActiveUri();
        recordRecent(target);
        openStage(target);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        logger.error(`MolVis: Open Stage failed: ${text}`);
      }
    }),
    vscode.commands.registerCommand("molvis.openPage", () => {
      try {
        openPagePanel(context, panelRegistry, logger);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        logger.error(`MolVis: Open Page failed: ${text}`);
      }
    }),
    vscode.commands.registerCommand("molvis.openSketch", (arg?: unknown) => {
      try {
        const target = uriFromFilesArg(arg) ?? resolveActiveUri();
        const sketchUri =
          target && isSketchPath(target.fsPath) ? target : undefined;
        if (sketchUri) recordRecent(sketchUri);
        openSketch(sketchUri);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        logger.error(`MolVis: Open Sketch failed: ${text}`);
      }
    }),
    vscode.commands.registerCommand("molvis.openStructure", async () => {
      const picked = await pickMolecularUri();
      if (!picked) return;
      if (isSketchPath(picked.fsPath)) {
        await loadIntoSketch(picked);
        return;
      }
      await loadIntoStage(picked);
    }),
    vscode.commands.registerCommand(
      "molvis.removeRecent",
      async (arg?: unknown) => {
        const target = uriFromFilesArg(arg);
        if (!target) return;
        await recentFiles.remove(target);
      },
    ),
    vscode.commands.registerCommand("molvis.clearRecent", async () => {
      await recentFiles.clear();
    }),
    vscode.commands.registerCommand("molvis.refreshFiles", () => {
      void files.refreshWorkspace();
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
      ? [createHotReloadWatcher(context, panelRegistry)]
      : []),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!affectsMolvisSettings(event)) return;
      const message = createApplySettingsMessage();
      // biome-ignore lint/complexity/noForEach: custom async iterator
      await panelRegistry.forEach((panel) => {
        sendToWebview(panel.webview, message);
      });
    }),
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.uri.scheme !== "file") return;
      if (!isMolecularPath(doc.uri.fsPath)) return;
      if (isSketchPath(doc.uri.fsPath)) {
        if (!activeSketch) return;
        void sendLoadedFile(activeSketch.webview, doc.uri, fileLoader, logger);
        return;
      }
      if (!activeStage) return;
      void sendLoadedFile(activeStage.webview, doc.uri, fileLoader, logger);
    }),
  );
}

export function getRegisteredPanelViewTypesForTests(): readonly string[] {
  return activePanelRegistry?.getRegisteredViewTypes() ?? [];
}

export function deactivate(): void {}
