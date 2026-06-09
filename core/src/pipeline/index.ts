// Core pipeline types and utilities

// Built-in modifiers
export {
  ClearSelectionModifier,
  SelectModifier,
} from "../modifiers/SelectModifier";
export { WrapPBCModifier } from "../modifiers/WrapPBCModifier";
// Bond column remap (paired with the file-load column-mapping dialog)
export {
  type BondColumnMapping,
  BondColumnRemapModifier,
  bondsIntegerColumns,
  bondsNeedColumnMapping,
} from "./bond_column_remap";
export type { Modifier } from "./modifier";
// Modifier base classes and interfaces
export {
  BaseModifier,
  ModifierCapability,
  primaryCapabilityLabel,
} from "./modifier";
export type { ModifierFactory } from "./modifier_registry";
// Modifier registry
export { ModifierRegistry, nextModifierId } from "./modifier_registry";
// NATO IDs and DAG utilities
export {
  generateNatoId,
  isSelectionProducer,
  isTopologyChanging,
  NATO_ALPHABET,
} from "./nato_ids";
// Pipeline execution
export { ModifierPipeline, PipelineEvents } from "./pipeline";
// Frame change classification (consumed by Draw modifiers)
export type {
  FrameChangeKind,
  PipelineContext,
  ValidationResult,
} from "./types";
export {
  createDefaultContext,
  pushSelectionScope,
  SelectionMask,
} from "./types";
