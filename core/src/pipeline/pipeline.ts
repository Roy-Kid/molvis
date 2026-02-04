import type { Frame } from "molwasm";
import { logger } from "../utils/logger";
import type { Modifier } from "./modifier";
import { createDefaultContext } from "./types";

/**
 * Frame source interface for loading frames.
 */
export interface FrameSource {
  getFrame(index: number): Promise<Frame> | Frame;
  getFrameCount(): number | null;
}

/**
 * Modifier pipeline that executes a sequence of modifiers.
 * Modifiers are stateless - all state is in the context and frame.
 */
import { EventEmitter } from "../events";

/**
 * Pipeline events that UI can subscribe to.
 */
export const PipelineEvents = {
  MODIFIER_ADDED: "modifier-added",
  MODIFIER_REMOVED: "modifier-removed",
  MODIFIER_REORDERED: "modifier-reordered",
  PIPELINE_CLEARED: "pipeline-cleared",
  COMPUTED: "computed",
};

/**
 * Modifier pipeline that executes a sequence of modifiers.
 * Modifiers are stateless - all state is in the context and frame.
 */
export class ModifierPipeline extends EventEmitter {
  private modifiers: Modifier[] = [];

  /**
   * Add a modifier to the end of the pipeline.
   */
  addModifier(modifier: Modifier): void {
    this.modifiers.push(modifier);
    this.emit(PipelineEvents.MODIFIER_ADDED, {
      modifier,
      index: this.modifiers.length - 1,
    });
  }

  /**
   * Remove a modifier from the pipeline.
   */
  removeModifier(modifierId: string): boolean {
    const index = this.modifiers.findIndex((m) => m.id === modifierId);
    if (index >= 0) {
      const [removed] = this.modifiers.splice(index, 1);
      this.emit(PipelineEvents.MODIFIER_REMOVED, { modifier: removed, index });
      return true;
    }
    return false;
  }

  /**
   * Get all modifiers in the pipeline.
   */
  getModifiers(): readonly Modifier[] {
    return this.modifiers;
  }

  /**
   * Reorder modifiers by moving a modifier to a new position.
   */
  reorderModifier(modifierId: string, newIndex: number): boolean {
    const oldIndex = this.modifiers.findIndex((m) => m.id === modifierId);
    if (oldIndex < 0 || newIndex < 0 || newIndex >= this.modifiers.length) {
      return false;
    }

    const [modifier] = this.modifiers.splice(oldIndex, 1);
    this.modifiers.splice(newIndex, 0, modifier);
    this.emit(PipelineEvents.MODIFIER_REORDERED, {
      modifier,
      oldIndex,
      newIndex,
    });
    return true;
  }

  /**
   * Compute the result of applying all modifiers to a frame.
   * This is a pure function - modifiers are stateless.
   */
  async compute(source: FrameSource, frameIndex = 0): Promise<Frame> {
    // Load initial frame
    let frame = await source.getFrame(frameIndex);

    // Create initial context
    const context = createDefaultContext(frame, frameIndex);

    // Apply each enabled modifier sequentially
    for (const modifier of this.modifiers) {
      if (!modifier.enabled) {
        continue;
      }

      // Validate modifier
      const validation = modifier.validate(frame, context);
      if (!validation.valid) {
        logger.warn(
          `Modifier ${modifier.name} validation failed:`,
          validation.errors,
        );
        continue;
      }

      // Apply modifier (modifiers are pure functions)
      frame = modifier.apply(frame, context);
    }

    this.emit(PipelineEvents.COMPUTED, { frame, context });
    return frame;
  }

  /**
   * Clear all modifiers from the pipeline.
   */
  clear(): void {
    this.modifiers = [];
    this.emit(PipelineEvents.PIPELINE_CLEARED, {});
  }
}
