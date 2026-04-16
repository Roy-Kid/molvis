/**
 * Commands module - Command pattern for MolVis operations
 *
 * All commands extend the Command base class with do() and undo() methods.
 * Commands are exposed for RPC using the @command decorator.
 */

// Core command infrastructure
export { Command, command, getCommandMetadata } from "./base";
export { commands, CommandRegistry } from "./registry";
export type { CommandFn } from "./registry";

// Command classes
export {
  DrawBoxCommand,
  DrawFrameCommand,
  DrawAtomCommand,
  DeleteAtomCommand,
  DrawBondCommand,
  DeleteBondCommand,
} from "./draw";
export { ClearSceneCommand } from "./clear";
export { getSelectedCommand, SelectAtomByIdCommand } from "./selection";
export { SetAttributeCommand, SetFrameMetaCommand } from "./attributes";
export {
  NewFrameCommand,
  UpdateFrameCommand,
  ExportFrameCommand,
} from "./frame";
export { TakeSnapshotCommand } from "./snapshot";
export { SetRepresentationCommand } from "./representation";
export {
  AddOverlayCommand,
  RemoveOverlayCommand,
  UpdateOverlayCommand,
  AddOverlaySnapshotCommand,
} from "./overlays";

export type { GetSelectedResponse } from "../selection_manager";

// Utilities

// Types
export type { FrameSource } from "../pipeline/pipeline";
export type { DrawFrameOption } from "./draw";
export {
  ArrayFrameSource,
  SingleFrameSource,
  AsyncFrameSource,
} from "./sources";

import "./draw";
import "./clear";
import "./selection";
import "./frame";
import "./snapshot";
import "./attributes";
import "./representation";
import "./overlays";

/**
 * Ensure the default command set is registered with the global `commands`
 * registry. Idempotent — all command modules register via `@command`
 * decorators at load time, so merely importing this module is enough. The
 * explicit function exists so `MolvisApp` and external consumers can state
 * intent at the call site.
 */
export function registerDefaultCommands(): void {
  // no-op; side-effect imports above have already run
}
