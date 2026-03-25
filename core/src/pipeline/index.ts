// Core pipeline types and utilities
export {
  SelectionMask,
  createDefaultContext,
  pushSelectionScope,
} from "./types";
export type { PipelineContext, ValidationResult } from "./types";

// Modifier base classes and interfaces
export { ModifierCategory, BaseModifier } from "./modifier";
export type { Modifier } from "./modifier";

// Pipeline execution
export { ModifierPipeline, PipelineEvents } from "./pipeline";
export type { FrameSource } from "./pipeline";

// Built-in modifiers
export {
  SelectModifier,
  ClearSelectionModifier,
} from "../modifiers/SelectModifier";
export { WrapPBCModifier } from "../modifiers/WrapPBCModifier";

// Modifier registry
export { ModifierRegistry, nextModifierId } from "./modifier_registry";
export type { ModifierFactory } from "./modifier_registry";

// NATO IDs and DAG utilities
export {
  NATO_ALPHABET,
  generateNatoId,
  isSelectionProducer,
  isTopologyChanging,
} from "./nato_ids";
