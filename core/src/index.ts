import init, { type InitOutput } from "molwasm";
declare const __WASM_INLINE__: boolean;

export let wasmInstance: InitOutput;

if (__WASM_INLINE__) {
  const { default: wasmUrl } = await import(
    // @ts-ignore
    /* webpackMode: "eager" */ "molwasm/molrs_wasm_bg.wasm?inline"
  );
  wasmInstance = await init(wasmUrl);
} else {
  wasmInstance = await init();
}

import { MolvisApp } from "./core/app";
import type { MolvisConfig } from "./core/config";

import type { MolvisSetting } from "./core/settings";

export function mountMolvis(
  container: HTMLElement,
  config: MolvisConfig = {},
  settings?: Partial<MolvisSetting>,
): MolvisApp {
  return new MolvisApp(container, config, settings);
}

export { MolvisApp as Molvis } from "./core/app";
export {
  defaultMolvisConfig,
  DEFAULT_CONFIG,
  type MolvisConfig,
} from "./core/config";
export {
  Settings,
  DEFAULT_SETTING,
  defaultMolvisSettings,
  type MolvisSetting,
} from "./core/settings";
export { Frame, Block, Box, Trajectory } from "./core/system/";
export { Topology } from "./core/system/topology";
export { System } from "./core/system";
export {
  World,
  SelectionManager,
  type SelectionState,
  parseSelectionKey,
} from "./core";
export {
  writeFrame,
  writePDBFrame,
  writeXYZFrame,
  writeLAMMPSData,
  type ExportFormat,
  type ExportPayload,
  type WriteFrameOptions,
  defaultExtensionForFormat,
  mimeForFormat,
} from "./core/writer";
export {
  readFrame,
  readPDBFrame,
  readXYZFrame,
  readLAMMPSData,
  inferFormatFromFilename,
} from "./core/reader";

export { ModeType } from "./mode";
export { ModifierRegistry } from "./pipeline/modifier_registry";
export { ModifierPipeline, PipelineEvents } from "./pipeline";
export type { Modifier } from "./pipeline/modifier";
export { ArrayFrameSource } from "./commands/sources";

export { DataSourceModifier } from "./pipeline/data_source_modifier";

// Register default commands
import "./commands";
