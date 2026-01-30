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
export { DrawBoxCommand, DrawFrameCommand } from "./draw";
export { ClearSceneCommand } from "./clear";
export { getSelectedCommand } from "./selection";
export type { GetSelectedResponse } from "../core/selection_manager";

// Utilities

// Types
export type { FrameSource } from "../pipeline/pipeline";
export type { DrawFrameOption } from "./draw";
export { ArrayFrameSource, SingleFrameSource, AsyncFrameSource } from "./sources";


import "./draw";
import "./clear";
import "./selection";
import "./update_frame";
