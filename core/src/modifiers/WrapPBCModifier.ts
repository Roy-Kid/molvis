import type { Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext } from "../pipeline/types";
import { logger } from "../utils/logger";

/**
 * WrapPBC modifier wraps atoms into the periodic box.
 * This is a selection-insensitive (global) operation.
 */
export class WrapPBCModifier extends BaseModifier {
  constructor(id: string) {
    super(id, "Wrap PBC", ModifierCategory.SelectionInsensitive);
  }

  apply(input: Frame, _context: PipelineContext): Frame {
    if (!input.simbox) {
      logger.warn("WrapPBC: Frame has no box, skipping");
      return input;
    }

    logger.info("WrapPBC: periodic wrapping is not implemented in v0.0.2");
    return input;
  }

  getCacheKey(): string {
    return `${super.getCacheKey()}`;
  }
}
