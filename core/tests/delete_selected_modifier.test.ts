import { describe, expect, it } from "@rstest/core";
import { initSync, Block, Frame } from "@molcrafts/molrs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DeleteSelectedModifier } from "../src/modifiers/DeleteSelectedModifier";
import { createDefaultContext } from "../src/pipeline/types";

const require = createRequire(__filename);
const wasmPath = require.resolve("@molcrafts/molrs/molwasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
initSync({ module: wasmBuffer });

function makeFrame(
  elements: string[],
  bonds?: [number, number][],
): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColumnF32("x", new Float32Array(elements.map((_, i) => i)));
  atoms.setColumnF32("y", new Float32Array(elements.length));
  atoms.setColumnF32("z", new Float32Array(elements.length));
  atoms.setColumnStrings("element", elements);
  frame.insertBlock("atoms", atoms);

  if (bonds) {
    const bondsBlock = new Block();
    bondsBlock.setColumnU32("i", new Uint32Array(bonds.map((b) => b[0])));
    bondsBlock.setColumnU32("j", new Uint32Array(bonds.map((b) => b[1])));
    frame.insertBlock("bonds", bondsBlock);
  }

  return frame;
}

describe("DeleteSelectedModifier", () => {
  it("should pass through when no deletions", () => {
    const mod = new DeleteSelectedModifier();
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);
    expect(result).toBe(frame);
  });

  it("should remove deleted atoms", () => {
    const mod = new DeleteSelectedModifier();
    mod.deleteIndices([1]); // delete O
    const frame = makeFrame(["C", "O", "N"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const atoms = result.getBlock("atoms")!;
    expect(atoms.nrows()).toBe(2);
    const elements = atoms.getColumnStrings("element")!;
    expect(elements).toEqual(["C", "N"]);
  });

  it("should remap bond indices after deletion", () => {
    const mod = new DeleteSelectedModifier();
    mod.deleteIndices([1]); // delete index 1
    // Bonds: 0-1 (removed), 0-2 (remapped to 0-1)
    const frame = makeFrame(["C", "H", "O"], [[0, 1], [0, 2]]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const bonds = result.getBlock("bonds")!;
    expect(bonds.nrows()).toBe(1);
    const iCol = bonds.getColumnU32("i")!;
    const jCol = bonds.getColumnU32("j")!;
    expect(iCol[0]).toBe(0); // C stays at 0
    expect(jCol[0]).toBe(1); // O remapped from 2 to 1
  });

  it("should return empty frame when all atoms deleted", () => {
    const mod = new DeleteSelectedModifier();
    mod.deleteIndices([0, 1]);
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);
    const atoms = result.getBlock("atoms");
    expect(!atoms || atoms.nrows() === 0).toBe(true);
  });

  it("restoreAll should clear deletions", () => {
    const mod = new DeleteSelectedModifier();
    mod.deleteIndices([0]);
    expect(mod.deletedCount).toBe(1);
    mod.restoreAll();
    expect(mod.deletedCount).toBe(0);
    const frame = makeFrame(["C"]);
    const ctx = createDefaultContext(frame);
    expect(mod.apply(frame, ctx)).toBe(frame);
  });

  it("should preserve coordinates after deletion", () => {
    const mod = new DeleteSelectedModifier();
    mod.deleteIndices([0]); // delete first atom
    const frame = makeFrame(["H", "C", "O"]);
    const ctx = createDefaultContext(frame);
    const result = mod.apply(frame, ctx);

    const atoms = result.getBlock("atoms")!;
    const x = atoms.getColumnF32("x")!;
    expect(x[0]).toBeCloseTo(1, 5); // C was at x=1
    expect(x[1]).toBeCloseTo(2, 5); // O was at x=2
  });
});
