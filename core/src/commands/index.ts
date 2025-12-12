/**
 * Commands module - the primary public API for MolVis operations.
 * 
 * This module provides:
 * - Command registry for registering and executing commands
 * - Helper functions for common operations
 * - Internal Ops (DataOp, RenderOp) for advanced use cases
 * - Artist utilities (palette, types)
 */

// Core registry
export { commands, CommandRegistry } from "./registry";
export type { CommandFn } from "./registry";

// Command helper functions
export { draw_atoms } from "./commands/drawAtoms";
export { draw_bonds } from "./commands/drawBonds";
export { draw_box } from "./commands/drawBox";
export { draw_frame } from "./commands/drawFrame";
export { draw_atom, draw_bond, delete_atom, delete_bond, change_atom_element, cycle_bond_order } from "./draw";
export { wrap_pbc } from "./commands/wrapPBC";
export { slice } from "./commands/slice";
export { select } from "./commands/select";
export { analyze } from "./commands/analyze";
export { highlight_atoms, clear_highlights } from "./highlight";
export { draw_trajectory, play_animation, pause_animation, set_animation_frame } from "./animation";

// Internal types (for advanced users who want to create custom Ops)
export type {
  DataOp,
  DataOpContext,
  DataPipelineContext,
  FrameSource,
  RenderOp,
  RenderOpContext,
  RenderPipelineContext,
} from "./types";

// Internal pipeline classes (for advanced use)
export { DataPipeline, RenderPipeline } from "./pipeline";

// Base Op classes (for creating custom Ops)
export { BaseDataOp } from "./dataOps/base";
export { BaseRenderOp } from "./renderOps/base";

// DataOps (for advanced use)
export { WrapPBCOp, type WrapPBCOptions } from "./dataOps/wrap_pbc";
export { SliceOp, type SliceOptions } from "./dataOps/slice";
export { SelectByPropertyOp, type SelectByPropertyOptions } from "./dataOps/select";
export { AnalysisOp, type RDFOptions } from "./dataOps/analysis";

// RenderOps (for advanced use)
export { DrawAtomsOp, type DrawAtomsOpOptions } from "./renderOps/draw_atoms";
export { DrawBondsOp, type DrawBondsOpOptions } from "./renderOps/draw_bonds";
export { DrawBoxOp, type DrawBoxOpOptions } from "./renderOps/draw_box";

// Frame sources
export {
  ArrayFrameSource,
  SingleFrameSource,
  AsyncFrameSource,
} from "./sources";

// Executor (for advanced use)
export { Executor } from "./executor";
export type { CommandRouter, CommandRuntime, CommandExecutionContext } from "./base";

// Artist utilities (palette, types)
export { DefaultPalette } from "./palette";
export type { Palette } from "./palette";
export type {
  DrawAtomInput,
  DrawBondInput,
  DrawBoxInput,
  DrawFrameInput,
  DrawGridInput,
} from "./types";

// Import commands to register them
import "./commands/drawAtoms";
import "./commands/drawBonds";
import "./commands/drawBox";
import "./commands/drawFrame";
import "./commands/wrapPBC";
import "./commands/slice";
import "./commands/select";
import "./commands/analyze";
import "./highlight";
import "./animation";
