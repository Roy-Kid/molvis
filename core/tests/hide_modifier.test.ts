
import { describe, expect, test } from "@rstest/core";
import { initSync, Frame, Block } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { HideSelectionModifier } from "../src/modifiers/HideSelectionModifier";
import { createDefaultContext } from "../src/pipeline/types";
import type { MolvisApp } from "../src/core/app";

const require = createRequire(__filename);
const wasmPath = require.resolve("@molcrafts/molrs/molwasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
initSync({ module: wasmBuffer });

describe("HideSelectionModifier", () => {
    // Mock app
    const mockApp = {} as MolvisApp;

    test("Should hide selected atoms", () => {
        // Setup Frame
        const frame = new Frame();
        const atoms = new Block();
        const count = 5;
        const xs = new Float32Array(count);
        const ys = new Float32Array(count);
        const zs = new Float32Array(count);
        const elements = ["C", "C", "H", "H", "O"]; // 0,1,2,3,4

        // Fill data
        for (let i = 0; i < count; i++) {
            xs[i] = i;
            ys[i] = 0;
            zs[i] = 0;
        }

        atoms.setColumnF32("x", xs);
        atoms.setColumnF32("y", ys);
        atoms.setColumnF32("z", zs);
        atoms.setColumnStrings("element", elements);
        frame.insertBlock("atoms", atoms);

        // Context
        const context = createDefaultContext(frame, mockApp);

        // Modifier
        const modifier = new HideSelectionModifier();

        // Validate empty
        expect(modifier.validate(frame, context).valid).toBe(true);
        let out = modifier.apply(frame, context);
        expect(out.getBlock("atoms")!.nrows()).toBe(5);

        // Hide indices 1 and 3
        modifier.hideIndices([1, 3]);
        expect(modifier.hiddenCount).toBe(2);

        out = modifier.apply(frame, context);
        const outAtoms = out.getBlock("atoms")!;
        expect(outAtoms.nrows()).toBe(3);

        // Check remaining elements: 0(C), 2(H), 4(O)
        const outEls = outAtoms.getColumnStrings("element");
        expect(outEls).toEqual(["C", "H", "O"]);

        // Check xs: 0, 2, 4
        const outXs = outAtoms.getColumnF32("x");
        expect(outXs![0]).toBe(0);
        expect(outXs![1]).toBe(2);
        expect(outXs![2]).toBe(4);
    });

    test("Should remove bonds connected to hidden atoms", () => {
        const frame = new Frame();
        const atoms = new Block();
        // 0-1-2 chain
        atoms.setColumnF32("x", new Float32Array([0, 1, 2]));
        atoms.setColumnF32("y", new Float32Array([0, 0, 0]));
        atoms.setColumnF32("z", new Float32Array([0, 0, 0]));
        atoms.setColumnStrings("element", ["C", "C", "C"]);
        frame.insertBlock("atoms", atoms);

        const bonds = new Block();
        // Bonds: 0-1, 1-2
        bonds.setColumnU32("i", new Uint32Array([0, 1]));
        bonds.setColumnU32("j", new Uint32Array([1, 2]));
        bonds.setColumnU8("order", new Uint8Array([1, 1]));
        frame.insertBlock("bonds", bonds);

        const context = createDefaultContext(frame, mockApp);
        const modifier = new HideSelectionModifier();

        // Hide atom 1 (middle)
        modifier.hideIndices([1]);

        const out = modifier.apply(frame, context);
        const outAtoms = out.getBlock("atoms")!;
        expect(outAtoms.nrows()).toBe(2); // 0 and 2 remain

        const outBonds = out.getBlock("bonds");
        // Should handle empty bonds block if all removed? 
        // Or return block with 0 rows?
        // Logic returns block if validBonds > 0.

        // Both bonds 0-1 and 1-2 connected to 1, so both should be removed.
        if (outBonds) {
            expect(outBonds.nrows()).toBe(0);
        } else {
            // If block missing, implied 0.
            expect(true).toBe(true);
        }
    });

    test("Should keep bonds between visible atoms", () => {
        const frame = new Frame();
        const atoms = new Block();
        // 0-1, 2 (isolated)
        atoms.setColumnF32("x", new Float32Array([0, 1, 10]));
        atoms.setColumnF32("y", new Float32Array([0, 0, 0]));
        atoms.setColumnF32("z", new Float32Array([0, 0, 0]));
        atoms.setColumnStrings("element", ["C", "C", "C"]);
        frame.insertBlock("atoms", atoms);

        const bonds = new Block();
        bonds.setColumnU32("i", new Uint32Array([0]));
        bonds.setColumnU32("j", new Uint32Array([1]));
        frame.insertBlock("bonds", bonds);

        const context = createDefaultContext(frame, mockApp);
        const modifier = new HideSelectionModifier();

        // Hide 2 (isolated)
        modifier.hideIndices([2]);

        const out = modifier.apply(frame, context);
        const outAtoms = out.getBlock("atoms")!;
        expect(outAtoms.nrows()).toBe(2); // 0, 1

        const outBonds = out.getBlock("bonds");
        expect(outBonds).toBeDefined();
        expect(outBonds!.nrows()).toBe(1);

        // Bond 0-1 should refer to new indices 0 and 1 (since 0->0, 1->1, 2->hidden)
        const is = outBonds!.getColumnU32("i")!;
        const js = outBonds!.getColumnU32("j")!;
        expect(is[0]).toBe(0);
        expect(js[0]).toBe(1);
    });
});
