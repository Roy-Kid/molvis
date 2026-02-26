import type { Frame } from "@molcrafts/molrs";
import type { PipelineContext, ValidationResult, SelectionMask as SelectionMaskType } from "./types";
import { SelectionMask } from "./types";

/**
 * Modifier category determines default selection behavior.
 */
export enum ModifierCategory {
  /**
   * Selection-sensitive modifiers operate only on currentSelection by default.
   * Examples: Delete, Move, AssignProperty, ComputeSurface
   */
  SelectionSensitive = "selection-sensitive",

  /**
   * Selection-insensitive modifiers operate on ALL atoms by default.
   * Examples: WrapPBC, NormalizeData, SpatialGrid, GlobalStyle
   */
  SelectionInsensitive = "selection-insensitive",
  /**
   * Data modifiers operate on the entire frame structure (e.g. loading, filtering).
   */
  Data = "data",
}

/**
 * Base interface for all modifiers in the pipeline.
 */
export interface Modifier {
  /**
   * Unique identifier for this modifier instance.
   */
  readonly id: string;

  /**
   * Human-readable name for UI display.
   */
  readonly name: string;

  /**
   * Whether this modifier is currently enabled.
   */
  enabled: boolean;

  /**
   * Modifier category determines default selection behavior.
   */
  readonly category: ModifierCategory;

  /**
   * Validate that this modifier can be applied to the input frame.
   */
  validate(input: Frame, context: PipelineContext): ValidationResult;

  /**
   * Apply this modifier to the input frame, producing a new frame.
   * Modifiers should not mutate the input frame.
   */
  apply(input: Frame, context: PipelineContext): Frame;

  /**
   * Get a cache key for this modifier's current state.
   * Used for caching modifier results.
   */
  getCacheKey(): string;
}

/**
 * Abstract base class for modifiers with common functionality.
 */
export abstract class BaseModifier implements Modifier {
  public enabled = true;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: ModifierCategory,
  ) {}

  /**
   * Default validation: always valid.
   * Override in subclasses for specific validation logic.
   */
  validate(_input: Frame, _context: PipelineContext): ValidationResult {
    return { valid: true };
  }

  /**
   * Apply this modifier. Must be implemented by subclasses.
   */
  abstract apply(input: Frame, context: PipelineContext): Frame;

  /**
   * Default cache key: modifier id + enabled state.
   * Override in subclasses to include modifier-specific parameters.
   */
  getCacheKey(): string {
    return `${this.id}:${this.enabled}`;
  }

  /**
   * Helper: Get the effective selection for this modifier.
   * Selection-sensitive modifiers use currentSelection by default.
   * Selection-insensitive modifiers use "all" by default.
   */
  protected getEffectiveSelection(
    context: PipelineContext,
    frameSize: number,
  ): SelectionMaskType {
    if (this.category === ModifierCategory.SelectionSensitive) {
      return context.currentSelection;
    }
    // Selection-insensitive: operate on all atoms
    return SelectionMask.all(frameSize);
  }
}
