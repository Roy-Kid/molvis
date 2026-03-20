import type { Frame } from "@molcrafts/molrs";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext, ValidationResult } from "../pipeline/types";
import { SelectionMask } from "../pipeline/types";
import { logger } from "../utils/logger";

export type SelectModifierMode = "replace" | "add" | "remove" | "toggle";

/**
 * Selection modifier that creates or updates a named selection.
 */
export class SelectModifier extends BaseModifier {
  constructor(
    id: string,
    private expression: string | number[],
    private selectionName?: string,
    public mode: SelectModifierMode = "replace",
  ) {
    super(
      id,
      `Select (${mode})`,
      ModifierCategory.SelectionSensitive,
    );
  }

  validate(input: Frame, _context: PipelineContext): ValidationResult {
    if (Array.isArray(this.expression)) {
      // Validate indices
      const atomsBlock = input.getBlock("atoms");
      const atomCount = atomsBlock?.nrows() ?? 0;
      const invalidIndices = this.expression.filter(
        (idx) => idx < 0 || idx >= atomCount,
      );
      if (invalidIndices.length > 0) {
        return {
          valid: false,
          errors: [`Invalid atom indices: ${invalidIndices.join(", ")}`],
        };
      }
    }
    return { valid: true };
  }

  apply(input: Frame, context: PipelineContext): Frame {
    // Evaluate selection
    let mask: SelectionMask;
    const atomsBlock = input.getBlock("atoms");
    const atomCount = atomsBlock?.nrows() ?? 0;

    if (Array.isArray(this.expression)) {
      // Selection by indices
      mask = SelectionMask.fromIndices(atomCount, this.expression);
    } else {
      // Expression evaluation is not wired in this modifier yet.
      logger.warn(
        "Expression-based selection not yet implemented, selecting all",
      );
      mask = SelectionMask.all(atomCount);
    }

    let nextMask = mask;
    switch (this.mode) {
      case "add":
        nextMask = context.currentSelection.union(mask);
        break;
      case "remove":
        nextMask = context.currentSelection.intersection(mask.invert());
        break;
      case "toggle": {
        const union = context.currentSelection.union(mask);
        const intersection = context.currentSelection.intersection(mask);
        nextMask = union.intersection(intersection.invert());
        break;
      }
      case "replace":
      default:
        nextMask = mask;
        break;
    }

    // Store in selectionSet if named
    if (this.selectionName) {
      context.selectionSet.set(this.selectionName, nextMask);
    }

    // Update currentSelection
    context.currentSelection = nextMask;

    // Frame is unchanged (selection is context-only)
    return input;
  }

  getCacheKey(): string {
    const exprKey = Array.isArray(this.expression)
      ? this.expression.join(",")
      : this.expression;
    return `${super.getCacheKey()}:${exprKey}:${this.selectionName ?? ""}:${this.mode}`;
  }
}

/**
 * Clear selection modifier that resets currentSelection to "all".
 */
export class ClearSelectionModifier extends BaseModifier {
  constructor(id: string) {
    super(id, "Clear Selection", ModifierCategory.SelectionSensitive);
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const atomsBlock = input.getBlock("atoms");
    const atomCount = atomsBlock?.nrows() ?? 0;
    context.currentSelection = SelectionMask.all(atomCount);
    return input;
  }
}
