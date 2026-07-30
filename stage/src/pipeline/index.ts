// Core pipeline types and utilities

// Built-in modifiers
export {
  type ExpandSelectionMode,
  ExpandSelectionModifier,
} from "../modifiers/ExpandSelectionModifier";
export { InvertSelectionModifier } from "../modifiers/InvertSelectionModifier";
export {
  ClearSelectionModifier,
  SelectModifier,
} from "../modifiers/SelectModifier";
export { SelectTypeModifier } from "../modifiers/SelectTypeModifier";
export { WrapPBCModifier } from "../modifiers/WrapPBCModifier";
// Bond column remap (paired with the file-load column-mapping dialog)
export {
  type BondColumnMapping,
  BondColumnRemapModifier,
  bondsIntegerColumns,
  bondsNeedColumnMapping,
} from "./bond_column_remap";
// Empty Scene bootstrap (single-path invariant)
export {
  createEmptyPrimaryDataSource,
  EMPTY_SCENE_FILENAME,
  ensurePrimaryDataSource,
  installEmptyPrimaryScene,
  primaryDataSource,
} from "./empty_scene";
export type { Modifier } from "./modifier";
// Modifier base classes and interfaces
export {
  BaseModifier,
  ModifierCapability,
  primaryCapabilityLabel,
} from "./modifier";
export type {
  ModifierCategory,
  ModifierFactory,
  RegisterModifierOptions,
} from "./modifier_registry";
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
