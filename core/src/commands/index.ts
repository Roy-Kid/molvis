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

// Utilities
export { DefaultPalette } from "./palette";
export type { Palette, ColorHex } from "./palette";

// Types
export type { FrameSource, DrawFrameOption } from "./types";
export { ArrayFrameSource, SingleFrameSource, AsyncFrameSource } from "./sources";
