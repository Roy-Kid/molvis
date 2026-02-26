import { describe, expect, test } from "@rstest/core";
import { initSync, Frame, Block } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ExpressionSelectionModifier } from "../src/modifiers/ExpressionSelectionModifier";
import { createDefaultContext } from "../src/pipeline/types";
import type { MolvisApp } from "../src/core/app";

const require = createRequire(__filename);
const wasmPath = require.resolve("@molcrafts/molrs/molwasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
initSync({ module: wasmBuffer });

describe("ExpressionSelectionModifier", () => {
    // Mock app
    const mockApp = {} as MolvisApp;

    test("Should support selection by element", () => {
        // Setup Frame
        const frame = new Frame();
        const atoms = new Block();
        atoms.setColumnF32("x", new Float32Array([0, 1, 2]));
        atoms.setColumnF32("y", new Float32Array([0, 0, 0]));
        atoms.setColumnF32("z", new Float32Array([0, 0, 0]));
        atoms.setColumnStrings("element", ["H", "C", "H"]);
        frame.insertBlock("atoms", atoms);

        // Context
        const context = createDefaultContext(frame, mockApp);

        // Modifier
        const modifier = new ExpressionSelectionModifier("test-1", "element == 'C'");

        // Validate
        expect(modifier.validate(frame, context).valid).toBe(true);

        // Apply
        modifier.apply(frame, context);

        // Check selection
        const selection = context.currentSelection;
        expect(selection.count()).toBe(1);
        expect(selection.isSelected(1)).toBe(true);
        expect(selection.isSelected(0)).toBe(false);
    });

    test("Should support coordinate expressions", () => {
        const frame = new Frame();
        const atoms = new Block();
        atoms.setColumnF32("x", new Float32Array([0, 10, -5]));
        atoms.setColumnF32("y", new Float32Array([0, 0, 0]));
        atoms.setColumnF32("z", new Float32Array([0, 0, 0]));
        atoms.setColumnStrings("element", ["H", "H", "H"]);
        frame.insertBlock("atoms", atoms);

        const context = createDefaultContext(frame, mockApp);
        const modifier = new ExpressionSelectionModifier("test-2", "x > 5");

        modifier.apply(frame, context);

        expect(context.currentSelection.isSelected(1)).toBe(true); // 10 > 5
        expect(context.currentSelection.isSelected(0)).toBe(false);
        expect(context.currentSelection.isSelected(2)).toBe(false);
    });

    test("Should handle invalid expressions gracefully during apply", () => {
        const frame = new Frame();
        const atoms = new Block();
        atoms.setColumnF32("x", new Float32Array([0]));
        atoms.setColumnF32("y", new Float32Array([0]));
        atoms.setColumnF32("z", new Float32Array([0]));
        atoms.setColumnStrings("element", ["H"]);
        frame.insertBlock("atoms", atoms);

        const context = createDefaultContext(frame, mockApp);

        // Empty expression should be VALID now
        const modifierEmpty = new ExpressionSelectionModifier("test-empty", "");
        expect(modifierEmpty.validate(frame, context).valid).toBe(true);
        // Apply should work (no selection)
        modifierEmpty.apply(frame, context);
        expect(context.currentSelection.count()).toBe(0);

        // Syntax error still invalid
        const modifierInvalid = new ExpressionSelectionModifier("test-err", "element ==");

        // Validate should catch it or apply should handle it?
        // In code, validate tries `new Function`.
        const validation = modifierInvalid.validate(frame, context);
        expect(validation.valid).toBe(false);
    });
});
