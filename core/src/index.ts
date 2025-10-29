import { MolvisApp } from "./core/app";
import { createMolvisDom } from "./dom/dom-manager";
import type { MolvisOptions } from "./dom/options";

export function mountMolvis(mountPoint: HTMLElement, options: MolvisOptions = {}): MolvisApp {
  const setup = createMolvisDom(mountPoint, options);
  return new MolvisApp(setup.canvas, setup.options, setup.context);
}

export { MolvisApp as Molvis } from "./core/app";
export { createMolvisDom } from "./dom/dom-manager";
export { resolveMolvisOptions } from "./dom/options";
export { Frame, AtomBlock as Atom, BondBlock as Bond, Topology, Box } from "./structure";
// System and Trajectory removed; use structure module only
export { World } from "./world";
export { GuiManager } from "./gui";
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
export type { MolvisOptions, ResolvedMolvisOptions, MolvisDomContext } from "./dom/options";
