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
  getColumnF32(name: string): Float32Array | null;
  getColumnU32(name: string): Uint32Array | null;
  getColumnU8(name: string): Uint8Array | null;
  getColumnStrings(name: string): string[] | null;
}

interface MockFrame {
  getBlock(name: string): MockBlock | null;
}

function buildAtomBlock(atoms: AtomSpec[]): MockBlock {
  const columnsF32 = new Map<string, Float32Array>([
    ["x", new Float32Array(atoms.map((atom) => atom.x))],
    ["y", new Float32Array(atoms.map((atom) => atom.y))],
    ["z", new Float32Array(atoms.map((atom) => atom.z))],
  ]);
  const columnsStrings = new Map<string, string[]>([
    ["element", atoms.map((atom) => atom.element)],
  ]);

  if (atoms.some((atom) => atom.type !== undefined)) {
    columnsStrings.set(
      "type",
      atoms.map((atom) => atom.type ?? ""),
    );
  }

  return {
    nrows() {
      return atoms.length;
    },
    getColumnF32(name: string) {
      return columnsF32.get(name) ?? null;
    },
    getColumnU32() {
      return null;
    },
    getColumnU8() {
      return null;
    },
    getColumnStrings(name: string) {
      return columnsStrings.get(name) ?? null;
    },
  };
}

function buildBondBlock(bonds: BondSpec[]): MockBlock {
  const columnsU32 = new Map<string, Uint32Array>([
    ["i", new Uint32Array(bonds.map((bond) => bond.i))],
    ["j", new Uint32Array(bonds.map((bond) => bond.j))],
  ]);
  const columnsU8 = new Map<string, Uint8Array>([
    ["order", new Uint8Array(bonds.map((bond) => bond.order ?? 1))],
  ]);

  return {
    nrows() {
      return bonds.length;
    },
    getColumnF32() {
      return null;
    },
    getColumnU32(name: string) {
      return columnsU32.get(name) ?? null;
    },
    getColumnU8(name: string) {
      return columnsU8.get(name) ?? null;
    },
    getColumnStrings() {
      return null;
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

  it("returns full when atom type column changes", () => {
    const previous = buildFrame([
      { x: 0, y: 0, z: 0, element: "C", type: "sp3" },
      { x: 1, y: 0, z: 0, element: "H", type: "s" },
    ]);
    const next = buildFrame([
      { x: 0, y: 0, z: 0, element: "C", type: "sp2" },
      { x: 1, y: 0, z: 0, element: "H", type: "s" },
    ]);
    const decision = classifyFrameTransition(previous, next);
    expect(decision.kind).toBe("full");
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
