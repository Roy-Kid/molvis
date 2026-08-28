import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { toDomainUint } from "@molcrafts/molvis-core";

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
    const fallback = toDomainUint([9]);
    expect(Array.from(atoms.getU32("id", fallback), Number)).toEqual([9]);
    atoms.setColF("x", new Float64Array([1]));
    expect(() => atoms.getU32("x", fallback)).toThrow(/must be u64/);
  });

  it("Frame.hasU32 / getU32 read a named block", () => {
    const frame = new Frame();
    const atoms = frame.createBlock("atoms");
    atoms.setColU32("type_id", toDomainUint([1, 2]));
    expect(frame.hasU32("atoms", "type_id")).toBe(true);
    expect(frame.hasI32("atoms", "res_seq")).toBe(false);
    expect(Array.from(frame.getU32("atoms", "type_id"), Number)).toEqual([
      1, 2,
    ]);
  });
});
