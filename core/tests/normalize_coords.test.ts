import { Block, Box, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import { normalizeAtomCoords } from "../src/io/normalize_coords";
import "./setup_wasm";

function makeFrame(atoms: Block, box?: Box): Frame {
  const frame = new Frame();
  frame.insertBlock("atoms", atoms);
  if (box) frame.simbox = box;
  return frame;
}

function readCoord(frame: Frame, axis: "x" | "y" | "z"): number[] {
  const atoms = frame.getBlock("atoms");
  if (!atoms) throw new Error("atoms block missing");
  return Array.from(atoms.copyColF(axis));
}

describe("normalizeAtomCoords", () => {
  it("is a no-op when x/y/z are already present", () => {
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([1, 2]));
    atoms.setColF("y", new Float64Array([3, 4]));
    atoms.setColF("z", new Float64Array([5, 6]));
    const frame = makeFrame(atoms);

    normalizeAtomCoords(frame);

    expect(readCoord(frame, "x")).toEqual([1, 2]);
    expect(readCoord(frame, "y")).toEqual([3, 4]);
    expect(readCoord(frame, "z")).toEqual([5, 6]);
  });

  it("copies xu/yu/zu → x/y/z when canonical columns are missing", () => {
    const atoms = new Block();
    atoms.setColF("xu", new Float64Array([10, 20]));
    atoms.setColF("yu", new Float64Array([30, 40]));
    atoms.setColF("zu", new Float64Array([50, 60]));
    const frame = makeFrame(atoms);

    normalizeAtomCoords(frame);

    expect(readCoord(frame, "x")).toEqual([10, 20]);
    expect(readCoord(frame, "y")).toEqual([30, 40]);
    expect(readCoord(frame, "z")).toEqual([50, 60]);
  });

  it("un-scales xs/ys/zs using an orthorhombic box", () => {
    const atoms = new Block();
    atoms.setColF("xs", new Float64Array([0.0, 0.5, 1.0]));
    atoms.setColF("ys", new Float64Array([0.0, 0.5, 1.0]));
    atoms.setColF("zs", new Float64Array([0.0, 0.5, 1.0]));
    const box = Box.ortho(
      new Float64Array([10, 20, 40]),
      new Float64Array([1, 2, 3]),
      true,
      true,
      true,
    );
    const frame = makeFrame(atoms, box);

    normalizeAtomCoords(frame);

    expect(readCoord(frame, "x")).toEqual([1, 6, 11]);
    expect(readCoord(frame, "y")).toEqual([2, 12, 22]);
    expect(readCoord(frame, "z")).toEqual([3, 23, 43]);
  });

  it("throws when scaled coords lack a simbox", () => {
    const atoms = new Block();
    atoms.setColF("xs", new Float64Array([0.5]));
    atoms.setColF("ys", new Float64Array([0.5]));
    atoms.setColF("zs", new Float64Array([0.5]));
    const frame = makeFrame(atoms);

    expect(() => normalizeAtomCoords(frame)).toThrow(/simulation box/i);
  });

  it("throws when atom coordinates are absent entirely", () => {
    const atoms = new Block();
    atoms.setColStr("element", ["C", "H"]);
    const frame = makeFrame(atoms);

    expect(() => normalizeAtomCoords(frame)).toThrow(/missing coordinate/i);
  });

  it("throws when sources mix scaled and real", () => {
    const atoms = new Block();
    atoms.setColF("xs", new Float64Array([0.5]));
    atoms.setColF("yu", new Float64Array([5.0]));
    atoms.setColF("zu", new Float64Array([5.0]));
    const box = Box.cube(10, new Float64Array([0, 0, 0]), true, true, true);
    const frame = makeFrame(atoms, box);

    expect(() => normalizeAtomCoords(frame)).toThrow(/mixed/i);
  });
});
