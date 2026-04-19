import type { Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import { classifyFrameTransition } from "../src/system/frame_diff";

interface AtomSpec {
  x: number;
  y: number;
  z: number;
  element: string;
  type?: string;
}

interface BondSpec {
  i: number;
  j: number;
  order?: number;
}

interface MockBlock {
  nrows(): number;
  dtype(name: string): string | undefined;
  viewColU32(name: string): Uint32Array;
  copyColStr(name: string): string[];
  copyColI32(name: string): Int32Array;
  copyColU32(name: string): Uint32Array;
  copyColF(name: string): Float64Array;
}

interface MockFrame {
  getBlock(name: string): MockBlock | null;
}

function buildAtomBlock(atoms: AtomSpec[]): MockBlock {
  const columnsStr = new Map<string, string[]>([
    ["element", atoms.map((atom) => atom.element)],
  ]);

  if (atoms.some((atom) => atom.type !== undefined)) {
    columnsStr.set(
      "type",
      atoms.map((atom) => atom.type ?? ""),
    );
  }

  return {
    nrows() {
      return atoms.length;
    },
    dtype(name: string) {
      if (columnsStr.has(name)) return "string";
      return undefined;
    },
    viewColU32(_name: string): Uint32Array {
      throw new Error("No u32 columns in atom block");
    },
    copyColStr(name: string): string[] {
      const col = columnsStr.get(name);
      if (!col) throw new Error(`Column '${name}' not found`);
      return col;
    },
    copyColI32(name: string): Int32Array {
      throw new Error(`Column '${name}' is not i32`);
    },
    copyColU32(name: string): Uint32Array {
      throw new Error(`Column '${name}' is not u32`);
    },
    copyColF(name: string): Float64Array {
      throw new Error(`Column '${name}' is not f64`);
    },
  };
}

interface LammpsAtomSpec {
  x: number;
  y: number;
  z: number;
  /** LAMMPS dump `type` column is i32 — no `element` at all. */
  type: number;
}

function buildLammpsAtomBlock(atoms: LammpsAtomSpec[]): MockBlock {
  const typeCol = new Int32Array(atoms.map((atom) => atom.type));
  return {
    nrows() {
      return atoms.length;
    },
    dtype(name: string) {
      if (name === "type") return "i32";
      return undefined;
    },
    viewColU32(_name: string): Uint32Array {
      throw new Error("No u32 columns in atom block");
    },
    copyColStr(name: string): string[] {
      throw new Error(`Column '${name}' not found or not string`);
    },
    copyColI32(name: string): Int32Array {
      if (name !== "type") throw new Error(`Column '${name}' not found`);
      return typeCol;
    },
    copyColU32(name: string): Uint32Array {
      throw new Error(`Column '${name}' is not u32`);
    },
    copyColF(name: string): Float64Array {
      throw new Error(`Column '${name}' is not f64`);
    },
  };
}

function buildBondBlock(bonds: BondSpec[]): MockBlock {
  const columnsU32 = new Map<string, Uint32Array>([
    ["atomi", new Uint32Array(bonds.map((bond) => bond.i))],
    ["atomj", new Uint32Array(bonds.map((bond) => bond.j))],
    ["order", new Uint32Array(bonds.map((bond) => bond.order ?? 1))],
  ]);

  return {
    nrows() {
      return bonds.length;
    },
    dtype(name: string) {
      if (columnsU32.has(name)) return "u32";
      return undefined;
    },
    viewColU32(name: string): Uint32Array {
      const col = columnsU32.get(name);
      if (!col) throw new Error(`Column '${name}' not found`);
      return col;
    },
    copyColStr(_name: string): string[] {
      throw new Error("No string columns in bond block");
    },
  };
}

function buildFrame(atoms: AtomSpec[], bonds?: BondSpec[]): Frame {
  const atomBlock = buildAtomBlock(atoms);
  const bondBlock = bonds && bonds.length > 0 ? buildBondBlock(bonds) : null;
  const frame: MockFrame = {
    getBlock(name: string) {
      if (name === "atoms") return atomBlock;
      if (name === "bonds") return bondBlock;
      return null;
    },
  };
  return frame as unknown as Frame;
}

function buildLammpsFrame(atoms: LammpsAtomSpec[]): Frame {
  const atomBlock = buildLammpsAtomBlock(atoms);
  const frame: MockFrame = {
    getBlock(name: string) {
      if (name === "atoms") return atomBlock;
      return null;
    },
  };
  return frame as unknown as Frame;
}

describe("classifyFrameTransition", () => {
  it("returns full when previous frame is missing", () => {
    const next = buildFrame([{ x: 0, y: 0, z: 0, element: "C" }]);
    const decision = classifyFrameTransition(null, next);
    expect(decision.kind).toBe("full");
  });

  it("returns full when atom count changes", () => {
    const previous = buildFrame([{ x: 0, y: 0, z: 0, element: "C" }]);
    const next = buildFrame([
      { x: 0, y: 0, z: 0, element: "C" },
      { x: 1, y: 0, z: 0, element: "H" },
    ]);
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("full");
  });

  it("returns full when atom identity column changes", () => {
    const previous = buildFrame([
      { x: 0, y: 0, z: 0, element: "C" },
      { x: 1, y: 0, z: 0, element: "H" },
    ]);
    const next = buildFrame([
      { x: 0.2, y: 0, z: 0, element: "N" },
      { x: 1.2, y: 0, z: 0, element: "H" },
    ]);
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("full");
  });

  it("returns bond when topology changes with stable counts", () => {
    const previous = buildFrame(
      [
        { x: 0, y: 0, z: 0, element: "C" },
        { x: 1, y: 0, z: 0, element: "H" },
        { x: 0, y: 1, z: 0, element: "H" },
      ],
      [
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ],
    );
    const next = buildFrame(
      [
        { x: 0.1, y: 0, z: 0, element: "C" },
        { x: 1.1, y: 0, z: 0, element: "H" },
        { x: 0.1, y: 1, z: 0, element: "H" },
      ],
      [
        { i: 0, j: 1, order: 1 },
        { i: 1, j: 2, order: 1 },
      ],
    );
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("bond");
  });

  it("returns full when bond count changes", () => {
    const previous = buildFrame(
      [
        { x: 0, y: 0, z: 0, element: "C" },
        { x: 1, y: 0, z: 0, element: "H" },
        { x: 0, y: 1, z: 0, element: "H" },
      ],
      [{ i: 0, j: 1, order: 1 }],
    );
    const next = buildFrame(
      [
        { x: 0, y: 0, z: 0, element: "C" },
        { x: 1, y: 0, z: 0, element: "H" },
        { x: 0, y: 1, z: 0, element: "H" },
      ],
      [
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ],
    );
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("full");
  });

  it("returns position on LAMMPS-style frames with no element column", () => {
    // Per convention, `element` is optional. Frames that only have `type`
    // still classify as `position` when atom count and coords structure match.
    const previous = buildLammpsFrame([
      { x: 0, y: 0, z: 0, type: 1 },
      { x: 1, y: 0, z: 0, type: 2 },
    ]);
    const next = buildLammpsFrame([
      { x: 0.1, y: 0, z: 0, type: 1 },
      { x: 1.1, y: 0, z: 0, type: 2 },
    ]);
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("position");
  });

  it("returns position when only coordinates change", () => {
    const previous = buildFrame(
      [
        { x: 0, y: 0, z: 0, element: "C" },
        { x: 1, y: 0, z: 0, element: "H" },
      ],
      [{ i: 0, j: 1, order: 1 }],
    );
    const next = buildFrame(
      [
        { x: 0.2, y: 0.1, z: 0, element: "C" },
        { x: 1.2, y: 0.1, z: 0, element: "H" },
      ],
      [{ i: 0, j: 1, order: 1 }],
    );
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("position");
  });
});
