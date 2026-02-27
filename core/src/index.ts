import init, { type InitOutput } from "@molcrafts/molrs";
declare const __WASM_INLINE__: boolean;

export let wasmInstance: InitOutput;

if (__WASM_INLINE__) {
  const { default: wasmUrl } = await import(
    /* webpackMode: "eager" */ "@molcrafts/molrs/molwasm_bg.wasm?inline"
  );
  wasmInstance = await init(wasmUrl);
} else {
  wasmInstance = await init();
}

import { MolvisApp } from "./app";
import type { MolvisConfig } from "./config";

import type { MolvisSetting } from "./settings";
export { MOLVIS_VERSION } from "./version";

export function mountMolvis(
  container: HTMLElement,
  config: MolvisConfig = {},
  settings?: Partial<MolvisSetting>,
): MolvisApp {
  return new MolvisApp(container, config, settings);
}

export { MolvisApp as Molvis } from "./app";
export {
  defaultMolvisConfig,
  DEFAULT_CONFIG,
  type MolvisConfig,
} from "./config";
export {
  Settings,
  DEFAULT_SETTING,
  defaultMolvisSettings,
  type MolvisSetting,
} from "./settings";
export {
  Frame,
  Block,
  Box,
  Trajectory,
  type FrameProvider,
} from "./system/index";
export { Topology } from "./system/topology";
export { System } from "./system";
export { World } from "./world";
export {
  SelectionManager,
  type SelectionState,
  parseSelectionKey,
} from "./selection_manager";
export {
  exportFrame,
  writeFrame,
  writePDBFrame,
  writeXYZFrame,
  writeLAMMPSData,
  type ExportFormat,
  type ExportPayload,
  type WriteFrameOptions,
  defaultExtensionForFormat,
  mimeForFormat,
} from "./writer";
export {
  readFrame,
  readPDBFrame,
  readXYZFrame,
  readLAMMPSData,
  inferFormatFromFilename,
  TrajectoryReader,
  deriveElementFromType,
  processZarrFrame,
} from "./reader";

export { ModeType } from "./mode";
export { ModifierRegistry } from "./pipeline/modifier_registry";
export { ModifierPipeline, PipelineEvents } from "./pipeline";
export type { Modifier } from "./pipeline/modifier";
export { ArrayFrameSource, ZarrFrameSource } from "./commands/sources";
export { ZarrReader } from "@molcrafts/molrs";

export { DataSourceModifier } from "./pipeline/data_source_modifier";
export { SliceModifier } from "./modifiers/SliceModifier";
export { ExpressionSelectionModifier } from "./modifiers/ExpressionSelectionModifier";
export { HideSelectionModifier } from "./modifiers/HideSelectionModifier";

export { EventEmitter, type MolvisEventMap, type Listener } from "./events";

// Register default commands
import "./commands";
