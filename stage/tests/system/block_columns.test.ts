import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";

describe("Block has*/get*", () => {
  it("hasF64 is true for x and hasF32 is not", () => {
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([1]));
    expect(atoms.hasF64("x")).toBe(true);
    expect(atoms.hasF32("x")).toBe(false);
    expect(Array.from(atoms.getF64("x"))).toEqual([1]);
    expect(() => atoms.getF32("x")).toThrow(/must be f32/);
  });

  it("hasI32 is false for a missing res_seq and getI32 throws", () => {
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0]));
    expect(atoms.hasI32("res_seq")).toBe(false);
    expect(() => atoms.getI32("res_seq")).toThrow(/res_seq/);
  });

  it("getU32 returns the default only when the key is absent", () => {
    const atoms = new Block();
    const fallback = new Uint32Array([9]);
    expect(Array.from(atoms.getU32("id", fallback))).toEqual([9]);
    atoms.setColF("x", new Float64Array([1]));
    expect(() => atoms.getU32("x", fallback)).toThrow(/must be u32/);
  });

  it("Frame.hasU32 / getU32 read a named block", () => {
    const frame = new Frame();
    const atoms = frame.createBlock("atoms");
    atoms.setColU32("type_id", new Uint32Array([1, 2]));
    expect(frame.hasU32("atoms", "type_id")).toBe(true);
    expect(frame.hasI32("atoms", "res_seq")).toBe(false);
    expect(Array.from(frame.getU32("atoms", "type_id"))).toEqual([1, 2]);
  });
});
