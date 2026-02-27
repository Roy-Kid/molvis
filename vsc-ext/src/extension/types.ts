import * as vscode from "vscode";

// --- Logger (was infra/logger.ts) ---

export interface Logger {
  error(message: string): void;
}

export class VsCodeLogger implements Logger {
  public error(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}

// --- Messages (was types/messages.ts) ---

export type MolecularFilePayload = string | Record<string, string>;

export type HostToWebviewMessage =
  | {
      type: "init";
      mode: "standalone" | "editor" | "app";
      config?: unknown;
      settings?: unknown;
    }
  | { type: "applySettings"; config?: unknown; settings?: unknown }
  | { type: "loadFile"; content: MolecularFilePayload; filename: string }
  | { type: "triggerSave" }
  | { type: "error"; message: string };

export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "saveFile"; data: string; suggestedName: string }
  | { type: "dirtyStateChanged"; isDirty: boolean }
  | { type: "error"; message: string };

// --- Panel (was types/panel.ts) ---

export interface WebviewPanelMeta {
  getHtml: () => string;
  reload?: () => Promise<void>;
}

export interface PanelRegistry {
  register(panel: vscode.WebviewPanel, meta: WebviewPanelMeta): void;
  unregister(panel: vscode.WebviewPanel): void;
  forEachVisible(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void>;
  forEach(
    callback: (
      panel: vscode.WebviewPanel,
      meta: WebviewPanelMeta,
    ) => Promise<void> | void,
  ): Promise<void>;
}
