import { describe, expect, it } from "@rstest/core";
import { initSync, Block, Frame } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  ALPHA_OVERRIDE,
  TransparentSelectionModifier,
} from "../src/modifiers/TransparentSelectionModifier";
import { createDefaultContext } from "../src/pipeline/types";

const require = createRequire(__filename);
const wasmPath = require.resolve("@molcrafts/molrs/molwasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
initSync({ module: wasmBuffer });

function makeFrame(elements: string[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColumnF32("x", new Float32Array(elements.length));
  atoms.setColumnF32("y", new Float32Array(elements.length));
  atoms.setColumnF32("z", new Float32Array(elements.length));
  atoms.setColumnStrings("element", elements);
  frame.insertBlock("atoms", atoms);
  return frame;
}

describe("TransparentSelectionModifier", () => {
  it("should pass through when no indices are captured", () => {
    const mod = new TransparentSelectionModifier();
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    expect(mod.apply(frame, ctx)).toBe(frame);
  });

  it("should inject alpha override for selected atoms", () => {
    const mod = new TransparentSelectionModifier();
    mod.opacity = 0.25;
    mod.setIndices([1]);

    const frame = makeFrame(["C", "O", "N"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const atoms = result.getBlock("atoms")!;
    const alpha = atoms.getColumnF32(ALPHA_OVERRIDE)!;

    expect(Number.isNaN(alpha[0])).toBe(true);
    expect(alpha[1]).toBeCloseTo(0.25, 5);
    expect(Number.isNaN(alpha[2])).toBe(true);
  });

  it("should preserve bonds and box", () => {
    const frame = makeFrame(["C", "O"]);
    const bonds = new Block();
    bonds.setColumnU32("i", new Uint32Array([0]));
    bonds.setColumnU32("j", new Uint32Array([1]));
    frame.insertBlock("bonds", bonds);

    const mod = new TransparentSelectionModifier();
    mod.setIndices([0]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    expect(result.getBlock("bonds")).not.toBeNull();
  });
});
