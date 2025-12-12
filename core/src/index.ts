import init from "molrs-wasm";

declare const __WASM_INLINE__: boolean;

if (__WASM_INLINE__) {
  const { default: wasmUrl } = await import("molrs-wasm/molrs_bg.wasm");
  await init(wasmUrl);
} else {
  await init();
}

import { MolvisApp } from "./core/app";
import type { MolvisOptions } from "./core/options";

export function mountMolvis(container: HTMLElement, options: MolvisOptions = {}): MolvisApp {
  return new MolvisApp(container, options);
}

export { MolvisApp as Molvis } from "./core/app";
export { resolveMolvisOptions } from "./core/options";
export { Frame, AtomBlock as Atom, BondBlock as Bond, Topology, Box } from "./structure";
export { World } from "./core";
export { GuiManager } from "./core/gui";
export { ModeType } from "./mode";
export type { MolvisOptions, ResolvedMolvisOptions } from "./core/options";
