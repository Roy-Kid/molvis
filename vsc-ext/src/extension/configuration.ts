import * as vscode from "vscode";
import type { HostToWebviewMessage } from "./types";

export interface MolvisWebviewOptions {
  config?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  /**
   * Mount options for the page bundle (`readMountOptsFromHost()`).
   * Includes `plugins` from workspace setting `molvis.plugins`.
   */
  mount?: {
    surface?: string;
    plugins?: string[];
  };
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

export function getMolvisWebviewOptions(
  surface?: string,
): MolvisWebviewOptions {
  const cfg = vscode.workspace.getConfiguration("molvis");
  const plugins = asStringList(cfg.get("plugins"));
  const mount: MolvisWebviewOptions["mount"] = {
    ...(surface ? { surface } : {}),
    ...(plugins ? { plugins } : {}),
  };
  return {
    config: asObject(cfg.get("config")),
    settings: asObject(cfg.get("settings")),
    ...(Object.keys(mount).length > 0 ? { mount } : {}),
  };
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
    event.affectsConfiguration("molvis.settings") ||
    event.affectsConfiguration("molvis.plugins")
  );
}
