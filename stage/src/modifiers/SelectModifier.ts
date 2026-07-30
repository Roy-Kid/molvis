import type { Frame } from "@molcrafts/molvis-core/molrs";
import { BaseModifier, ModifierCapability } from "../pipeline/modifier";
import type { PipelineContext, ValidationResult } from "../pipeline/types";
import { SelectionMask } from "../pipeline/types";
import { ExpressionSelector } from "../selection/expression";

export type SelectModifierMode = "replace" | "add" | "remove" | "toggle";

/**
 * Selection modifier that creates or updates a named selection.
 * Supports atom indices, boolean expressions (via {@link ExpressionSelector}),
 * and bond IDs.
 */
export class SelectModifier extends BaseModifier {
  /** When false, the pipeline selection will not trigger visual highlighting. */
  public highlight = true;

  constructor(
    id: string,
    private _expression: string | number[],
    public mode: SelectModifierMode = "replace",
    private bondIds: number[] = [],
  ) {
    super(
      id,
      `Select (${mode})`,
      new Set([
        ModifierCapability.ConsumesSelection,
        ModifierCapability.ProducesSelection,
      ]),
    );
  }

  /** The selection source: atom indices array or expression string. */
  get selectionSource(): string | number[] {
    return this._expression;
  }

  /** Human-readable summary for UI display. */
  get selectionSummary(): string {
    if (Array.isArray(this._expression)) {
      return `${this._expression.length} atoms`;
    }
    return this._expression || "empty";
  }

  /** Display name: NATO ID (e.g. "Alpha"). */
  get name(): string {
    return this.id;
  }

  validate(input: Frame, _context: PipelineContext): ValidationResult {
    if (Array.isArray(this._expression)) {
      // Validate indices
      const atomsBlock = input.getBlock("atoms");
      const atomCount = atomsBlock?.nrows() ?? 0;
      const invalidIndices = this._expression.filter(
        (idx) => idx < 0 || idx >= atomCount,
      );
      if (invalidIndices.length > 0) {
        return {
          valid: false,
          errors: [`Invalid atom indices: ${invalidIndices.join(", ")}`],
        };
      }
      return { valid: true };
    }

    if (!this._expression?.trim()) {
      return { valid: true };
    }
    try {
      ExpressionSelector.compile(this._expression);
    } catch (e) {
      return {
        valid: false,
        errors: [`Invalid expression syntax: ${(e as Error).message}`],
      };
    }
    return { valid: true };
  }

  apply(input: Frame, context: PipelineContext): Frame {
    // Evaluate selection
    let mask: SelectionMask;
    const atomsBlock = input.getBlock("atoms");
    const atomCount = atomsBlock?.nrows() ?? 0;

    if (Array.isArray(this._expression)) {
      // Selection by indices
      mask = SelectionMask.fromIndices(atomCount, this._expression);
    } else if (!this._expression?.trim()) {
      mask = SelectionMask.fromIndices(atomCount, []);
    } else {
      let indices: number[] = [];
      try {
        ExpressionSelector.compile(this._expression);
        indices = ExpressionSelector.selectFromFrame(input, this._expression);
      } catch {
        // Invalid syntax: never silent select-all.
        indices = [];
      }
      mask = SelectionMask.fromIndices(atomCount, indices);
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
      default:
        nextMask = mask;
        break;
    }

    // Store in selectionSet using modifier ID as key
    context.selectionSet.set(this.id, nextMask);

    // Update currentSelection
    context.currentSelection = nextMask;

    // Store bond IDs on context for COMPUTED sync
    context.selectedBondIds = this.bondIds;

    // Propagate highlight suppression
    if (!this.highlight) {
      context.suppressHighlight = true;
    }

    // Frame is unchanged (selection is context-only)
    return input;
  }

  getCacheKey(): string {
    const exprKey = Array.isArray(this._expression)
      ? this._expression.join(",")
      : this._expression;
    const bondKey =
      this.bondIds.length > 0 ? `:b${this.bondIds.join(",")}` : "";
    return `${super.getCacheKey()}:${exprKey}:${this.mode}${bondKey}`;
  }
}

/**
 * Clear selection modifier that resets currentSelection to "all".
 */
export class ClearSelectionModifier extends BaseModifier {
  constructor(id: string) {
    super(
      id,
      "Clear Selection",
      new Set([ModifierCapability.ProducesSelection]),
    );
  }

  apply(input: Frame, context: PipelineContext): Frame {
    const atomsBlock = input.getBlock("atoms");
    const atomCount = atomsBlock?.nrows() ?? 0;
    context.currentSelection = SelectionMask.all(atomCount);
    context.selectedBondIds = [];
    return input;
  }
}
