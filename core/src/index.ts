import init from "molrs";
await init();

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
export {
  ArtistBase,
  ArtistRegistry,
  InstancedArtist,
  ArtistCommand,
} from "./artist";
export type {
  ArtistContext,
  ArtistOp,
  ArtistCtor,
  DrawAtomInput,
  DrawBondInput,
  DrawBoxInput,
  DrawFrameInput,
  DrawGridInput,
} from "./artist";
export { ModeType } from "./mode";
export type { MolvisOptions, ResolvedMolvisOptions } from "./core/options";
