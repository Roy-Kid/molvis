import * as vscode from "vscode";
import type { HostToWebviewMessage } from "../protocol";

/**
 * Stage config + runtime settings from VS Code settings.
 * Applied via `init` / `applySettings` postMessage (not page mount opts).
 */
export interface MolvisWebviewOptions {
  config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function getMolvisWebviewOptions(): MolvisWebviewOptions {
  const cfg = vscode.workspace.getConfiguration("molvis");
  return {
    config: asObject(cfg.get("config")),
    settings: asObject(cfg.get("settings")),
  };
}

/** Which surface a molecular file opens in (`molvis.defaultViewer`). */
export type DefaultViewer = "quickLook" | "page";

/**
 * Read `molvis.defaultViewer`.
 *
 * `page` exists because promoting a Quick look to the Page reloads the file:
 * the two tabs are separate webviews with their own engine and wasm, so the
 * parsed frame cannot be handed over and the payload crosses the host channel
 * a second time. Opening straight into the Page skips that first load.
 */
export function getDefaultViewer(): DefaultViewer {
  const value = vscode.workspace
    .getConfiguration("molvis")
    .get<string>("defaultViewer");
  return value === "page" ? "page" : "quickLook";
}

export function createInitMessage(): HostToWebviewMessage {
  const options = getMolvisWebviewOptions();
  return {
    type: "init",
    config: options.config,
    settings: options.settings,
  };
}

export function createApplySettingsMessage(): HostToWebviewMessage {
  const options = getMolvisWebviewOptions();
  return {
    type: "applySettings",
    config: options.config,
    settings: options.settings,
  };
}

export function affectsMolvisSettings(
  event: vscode.ConfigurationChangeEvent,
): boolean {
  return (
    event.affectsConfiguration("molvis.config") ||
    event.affectsConfiguration("molvis.settings")
  );
}
