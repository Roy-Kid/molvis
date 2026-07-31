/**
 * Shared host modules for plugin import-map injection.
 *
 * Plugins must externalize these packages; the loader rewrites bare
 * imports to blob URLs that re-export the host's singleton instances.
 *
 * - `@molcrafts/molvis-stage` / `@molvis/stage` — 3D engine
 * - `@molcrafts/molvis-core/molrs` — sole WASM binding
 * - `@molcrafts/molvis-core/elements` — pure element catalog
 * - `@molcrafts/molplot` — Vega-Lite charts (shared singleton; do not bundle)
 */

import * as Molplot from "@molcrafts/molplot";
import * as MolvisElements from "@molcrafts/molvis-core/elements";
import * as Molrs from "@molcrafts/molvis-core/molrs";
import * as MolvisStage from "@molvis/stage";
import * as React from "react";
import * as JsxDevRuntime from "react/jsx-dev-runtime";
import * as JsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

export const pluginHostModules = {
  react: React,
  "react-dom": ReactDOM,
  "react-dom/client": ReactDOMClient,
  "react/jsx-runtime": JsxRuntime,
  "react/jsx-dev-runtime": JsxDevRuntime,
  "@molvis/stage": MolvisStage,
  "@molcrafts/molvis-stage": MolvisStage,
  "@molcrafts/molvis-core/molrs": Molrs,
  "@molcrafts/molvis-core/elements": MolvisElements,
  "@molcrafts/molplot": Molplot,
} as const;

export type PluginHostModuleId = keyof typeof pluginHostModules;
