import { describe, expect, it } from "@rstest/core";
import { initSync, Block, Frame } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { AssignColorModifier } from "../src/modifiers/AssignColorModifier";
import {
  COLOR_OVERRIDE_R,
  COLOR_OVERRIDE_G,
  COLOR_OVERRIDE_B,
} from "../src/modifiers/ColorByPropertyModifier";
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

describe("AssignColorModifier", () => {
  it("should pass through when no assignments", () => {
    const mod = new AssignColorModifier();
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);
    expect(result).toBe(frame);
  });

  it("should inject color override columns for assigned atoms", () => {
    const mod = new AssignColorModifier();
    mod.addAssignment([0], "#FF0000");
    const frame = makeFrame(["C", "O", "N"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const atoms = result.getBlock("atoms")!;
    const r = atoms.getColumnF32(COLOR_OVERRIDE_R)!;
    const g = atoms.getColumnF32(COLOR_OVERRIDE_G)!;
    const b = atoms.getColumnF32(COLOR_OVERRIDE_B)!;

    // Atom 0 should be red (linear space)
    expect(r[0]).toBeGreaterThan(0.5);
    expect(g[0]).toBeCloseTo(0, 2);
    expect(b[0]).toBeCloseTo(0, 2);
  });

  it("should handle multiple assignments", () => {
    const mod = new AssignColorModifier();
    mod.addAssignment([0], "#FF0000"); // red
    mod.addAssignment([1], "#0000FF"); // blue
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const atoms = result.getBlock("atoms")!;
    const r = atoms.getColumnF32(COLOR_OVERRIDE_R)!;
    const b = atoms.getColumnF32(COLOR_OVERRIDE_B)!;

    expect(r[0]).toBeGreaterThan(0.5); // atom 0 is red
    expect(b[1]).toBeGreaterThan(0.5); // atom 1 is blue
  });

  it("should preserve bonds and box", () => {
    const frame = makeFrame(["C", "O"]);
    const bonds = new Block();
    bonds.setColumnU32("i", new Uint32Array([0]));
    bonds.setColumnU32("j", new Uint32Array([1]));
    frame.insertBlock("bonds", bonds);

    const mod = new AssignColorModifier();
    mod.addAssignment([0], "#FF0000");
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    expect(result.getBlock("bonds")).not.toBeNull();
  });

  it("clearAssignments should reset", () => {
    const mod = new AssignColorModifier();
    mod.addAssignment([0], "#FF0000");
    mod.clearAssignments();
    const frame = makeFrame(["C"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);
    expect(result).toBe(frame);
  });

  it("should produce different cache keys", () => {
    const mod = new AssignColorModifier();
    const key1 = mod.getCacheKey();
    mod.addAssignment([0], "#FF0000");
    const key2 = mod.getCacheKey();
    expect(key1).not.toBe(key2);
  });
});
