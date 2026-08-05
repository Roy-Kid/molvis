/**
 * Shared host modules for plugin import-map injection.
 *
 * Plugins must externalize these packages; the loader rewrites bare
 * imports to blob URLs that re-export the host's singleton instances.
 *
 * - `@molcrafts/molvis-stage` — 3D engine
 * - `@molcrafts/molvis-core/molrs` — sole WASM binding
 * - `@molcrafts/molvis-core/elements` — pure element catalog
 * - `@molcrafts/molplot` — Vega-Lite charts (shared singleton; do not bundle)
 */

import * as MolvisElements from "@molcrafts/molvis-core/elements";
import * as MolvisKeys from "@molcrafts/molvis-core/keys";
import * as Molrs from "@molcrafts/molvis-core/molrs";
import * as MolvisStage from "@molcrafts/molvis-stage";
import * as React from "react";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import * as JsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

const eagerPluginHostModules = {
  react: React,
  "react-dom": ReactDOM,
  "react-dom/client": ReactDOMClient,
  "react/jsx-runtime": JsxRuntime,
  "react/jsx-dev-runtime": JsxDevRuntime,
  "@molcrafts/molvis-stage": MolvisStage,
  "@molcrafts/molvis-core/molrs": Molrs,
  "@molcrafts/molvis-core/elements": MolvisElements,
  "@molcrafts/molvis-core/keys": MolvisKeys,
} as const;

export type PluginHostModules = typeof eagerPluginHostModules & {
  "@molcrafts/molplot": typeof import("@molcrafts/molplot");
};

let pluginHostModulesPromise: Promise<PluginHostModules> | undefined;

/**
 * Resolve optional, heavy plugin peers only when a plugin is actually loaded.
 * Keeping molplot/Vega out of this module's static graph saves the normal
 * viewer startup path while preserving a single shared instance for plugins.
 */
export function getPluginHostModules(): Promise<PluginHostModules> {
  pluginHostModulesPromise ??= import("@molcrafts/molplot").then((Molplot) => ({
    ...eagerPluginHostModules,
    "@molcrafts/molplot": Molplot,
  }));
  return pluginHostModulesPromise;
}

export type PluginHostModuleId = keyof PluginHostModules;
