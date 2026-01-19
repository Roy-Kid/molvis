import type { Frame } from "../core/system/frame";
import { BaseModifier, ModifierCategory } from "../pipeline/modifier";
import type { PipelineContext, ValidationResult } from "../pipeline/types";
import { SelectionMask } from "../pipeline/types";

/**
 * Selection modifier that creates or updates a named selection.
 */
export class SelectModifier extends BaseModifier {
    constructor(
        id: string,
        private expression: string | number[],
        private selectionName?: string
    ) {
        super(id, `Select: ${selectionName ?? "Current"}`, ModifierCategory.SelectionSensitive);
    }

    validate(input: Frame, _context: PipelineContext): ValidationResult {
        if (Array.isArray(this.expression)) {
            // Validate indices
            const invalidIndices = this.expression.filter(
                idx => idx < 0 || idx >= input.getAtomCount()
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

        if (Array.isArray(this.expression)) {
            // Selection by indices
            mask = SelectionMask.fromIndices(input.getAtomCount(), this.expression);
        } else {
            // TODO: Expression-based selection (future enhancement)
            // For now, just select all
            console.warn("Expression-based selection not yet implemented, selecting all");
            mask = SelectionMask.all(input.getAtomCount());
        }

        // Store in selectionSet if named
        if (this.selectionName) {
            context.selectionSet.set(this.selectionName, mask);
        }

        // Update currentSelection
        context.currentSelection = mask;

        // Frame is unchanged (selection is context-only)
        return input;
    }

    getCacheKey(): string {
        const exprKey = Array.isArray(this.expression)
            ? this.expression.join(",")
            : this.expression;
        return `${super.getCacheKey()}:${exprKey}:${this.selectionName ?? ""}`;
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
        context.currentSelection = SelectionMask.all(input.getAtomCount());
        return input;
    }
}
