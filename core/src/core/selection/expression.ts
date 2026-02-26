import type { SceneIndex } from "../scene_index";
import type { Frame } from "@molcrafts/molrs";

/**
 * Parses and evaluates boolean expressions for atom selection.
 */
export class ExpressionSelector {
    /**
     * Select atoms based on a boolean expression from SceneIndex.
     * returns selection keys.
     */
    static select(sceneIndex: SceneIndex, expression: string): string[] {
        const matchingKeys: string[] = [];
        const evaluator = this.createEvaluator(expression);

        const atomSource = sceneIndex.metaRegistry.atoms;

        for (const atomId of atomSource.getAllIds()) {
            const meta = atomSource.getMeta(atomId);
            if (!meta) continue;

            const { x, y, z } = meta.position;
            const element = meta.element;
            const index = atomId;
            const atomProxy = { ...meta };

            try {
                if (evaluator(atomProxy, x, y, z, element, atomId, index)) {
                    const key = sceneIndex.getSelectionKeyForAtom(atomId);
                    if (key) matchingKeys.push(key);
                }
            } catch (e) {
                // Ignore errors
            }
        }
        return matchingKeys;
    }

    /**
     * Select atoms based on a boolean expression from a Frame.
     * returns atom indices.
     */
    static selectFromFrame(frame: Frame, expression: string): number[] {
        const indices: number[] = [];
        const evaluator = this.createEvaluator(expression);

        const atomsBlock = frame.getBlock("atoms");
        if (!atomsBlock) return [];

        const count = atomsBlock.nrows();
        const xCol = atomsBlock.getColumnF32("x");
        const yCol = atomsBlock.getColumnF32("y");
        const zCol = atomsBlock.getColumnF32("z");
        const elCol = atomsBlock.getColumnStrings("element");

        if (!xCol || !yCol || !zCol || !elCol) return [];

        for (let i = 0; i < count; i++) {
            const x = xCol[i];
            const y = yCol[i];
            const z = zCol[i];
            const element = elCol[i];
            // Proxy is limited for frame unless we construct full object, 
            // but for perf we might skip if not needed by expression?
            // For consistency let's provide basic props
            const atomProxy = { x, y, z, element, atomId: i };

            try {
                if (evaluator(atomProxy, x, y, z, element, i, i)) {
                    indices.push(i);
                }
            } catch (e) {
                // Ignore
            }
        }
        return indices;
    }

    private static createEvaluator(expression: string): Function {
        try {
            return new Function(
                "atom", "x", "y", "z", "element", "id", "index",
                `"use strict"; return (${expression});`
            );
        } catch (e) {
            throw new Error(`Invalid expression: ${expression}`);
        }
    }
}
