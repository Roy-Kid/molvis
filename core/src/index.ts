import init, { type InitOutput } from "molrs-wasm";
declare const __WASM_INLINE__: boolean;

export let wasmInstance: InitOutput;

if (__WASM_INLINE__) {
	const { default: wasmUrl } = await import(
    // @ts-ignore
    /* webpackMode: "eager" */ "molrs-wasm/molrs_bg.wasm?inline"
	);
	wasmInstance = await init(wasmUrl);
} else {
	wasmInstance = await init();
}

import { MolvisApp } from "./core/app";
import type { MolvisConfig } from "./core/config";

export function mountMolvis(
	container: HTMLElement,
	config: MolvisConfig = {},
): MolvisApp {
	return new MolvisApp(container, config);
}

export { MolvisApp as Molvis } from "./core/app";
export { mergeConfig, DEFAULT_CONFIG, type MolvisConfig } from "./core/config";
export { Settings, DEFAULT_SETTING, type MolvisSetting } from "./core/settings";
export { Frame, Block, Box, Trajectory } from "./core/system/";
export { Topology } from "./core/system/topology";
export { System } from "./core/system";
export { World } from "./core";
export {
	writeFrame,
	type ExportFormat,
	type ExportPayload,
	type WriteFrameOptions,
	defaultExtensionForFormat,
	mimeForFormat
} from "./core/writer";
export {
	readFrame,
	inferFormatFromFilename
} from "./core/reader";

export { ModeType } from "./mode";
export { ModifierRegistry } from "./pipeline/modifier_registry";
export { ModifierPipeline, PipelineEvents } from "./pipeline";
export type { Modifier } from "./pipeline/modifier";
export { ArrayFrameSource } from "./commands/sources";
export {
	DrawAtomsModifier,
	DrawBondsModifier,
	DrawBoxModifier,
} from "./pipeline/rendering_modifiers";
export { DataSourceModifier } from "./pipeline/data_source_modifier";

// Register default commands
import "./commands";
