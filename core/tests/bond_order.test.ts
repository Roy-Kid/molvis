import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import {
  buildBondBuffers,
  countBondInstances,
} from "../src/artist/bond_buffer";

function makeBlocks(
  atomCount: number,
  bonds: { i: number; j: number; order: number }[],
): { atoms: Block; bonds: Block } {
  const atoms = new Block();
  atoms.setColF(
    "x",
    new Float32Array(atomCount).fill(0).map((_, i) => i),
  );
  atoms.setColF("y", new Float32Array(atomCount).fill(0));
  atoms.setColF("z", new Float32Array(atomCount).fill(0));
  atoms.setColStr("element", Array(atomCount).fill("C"));

  const bondsBlock = new Block();
  bondsBlock.setColU32("atomi", new Uint32Array(bonds.map((b) => b.i)));
  bondsBlock.setColU32("atomj", new Uint32Array(bonds.map((b) => b.j)));
  bondsBlock.setColU32("order", new Uint32Array(bonds.map((b) => b.order)));

  return { atoms, bonds: bondsBlock };
}

function makeAtomColor(count: number): Float32Array {
  const color = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    color[i * 4 + 0] = 0.5;
    color[i * 4 + 1] = 0.5;
    color[i * 4 + 2] = 0.5;
    color[i * 4 + 3] = 1.0;
  }
  return color;
}

describe("countBondInstances", () => {
  it("should return nrows for all single bonds", () => {
    const { bonds } = makeBlocks(3, [
      { i: 0, j: 1, order: 1 },
      { i: 1, j: 2, order: 1 },
    ]);
    expect(countBondInstances(bonds)).toBe(2);
  });

  it("should return 2 instances for a double bond", () => {
    const { bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 2 }]);
    expect(countBondInstances(bonds)).toBe(2);
  });

  it("should return 3 instances for a triple bond", () => {
    const { bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 3 }]);
    expect(countBondInstances(bonds)).toBe(3);
  });

  it("should sum mixed orders", () => {
    const { bonds } = makeBlocks(4, [
      { i: 0, j: 1, order: 1 },
      { i: 1, j: 2, order: 2 },
      { i: 2, j: 3, order: 3 },
    ]);
    // 1 + 2 + 3 = 6
    expect(countBondInstances(bonds)).toBe(6);
  });

  it("should clamp order to max 3", () => {
    const { bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 5 }]);
    expect(countBondInstances(bonds)).toBe(3);
  });
});

describe("buildBondBuffers with bond order", () => {
  it("should produce 1 instance for single bond", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 1 }]);
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    expect(result).not.toBeUndefined();
    expect(result?.instanceCount).toBe(1);
    expect(result?.instanceMap[0]).toBe(0);
  });

  it("should produce 2 instances for double bond", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 2 }]);
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    expect(result?.instanceCount).toBe(2);
    // Both instances map to logical bond 0
    expect(result?.instanceMap[0]).toBe(0);
    expect(result?.instanceMap[1]).toBe(0);
  });

  it("should produce 3 instances for triple bond", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 3 }]);
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    expect(result?.instanceCount).toBe(3);
    expect(result?.instanceMap[0]).toBe(0);
    expect(result?.instanceMap[1]).toBe(0);
    expect(result?.instanceMap[2]).toBe(0);
  });

  it("should produce correct buffer sizes for mixed orders", () => {
    const { atoms, bonds } = makeBlocks(4, [
      { i: 0, j: 1, order: 1 },
      { i: 1, j: 2, order: 2 },
      { i: 2, j: 3, order: 3 },
    ]);
    const atomColor = makeAtomColor(4);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    expect(result?.instanceCount).toBe(6);
    expect(result?.buffers.get("matrix")?.length).toBe(6 * 16);
    expect(result?.buffers.get("instanceData0")?.length).toBe(6 * 4);
  });

  it("should map instances to correct logical bonds", () => {
    const { atoms, bonds } = makeBlocks(4, [
      { i: 0, j: 1, order: 1 }, // instance 0 → bond 0
      { i: 1, j: 2, order: 2 }, // instances 1,2 → bond 1
      { i: 2, j: 3, order: 1 }, // instance 3 → bond 2
    ]);
    const atomColor = makeAtomColor(4);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    expect(result?.instanceCount).toBe(4);
    expect(result?.instanceMap[0]).toBe(0);
    expect(result?.instanceMap[1]).toBe(1);
    expect(result?.instanceMap[2]).toBe(1);
    expect(result?.instanceMap[3]).toBe(2);
  });

  it("double bond sub-instances should have smaller radius", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 2 }]);
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42, {
      radius: 0.1,
    });
    const data0 = result?.buffers.get("instanceData0")!;
    // Sub-bond radius should be 0.1 * 0.7 = 0.07
    expect(data0[3]).toBeCloseTo(0.07, 3);
    expect(data0[7]).toBeCloseTo(0.07, 3);
  });

  it("double bond sub-instances should be offset from center", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 2 }]);
    // Place atoms far apart along X to get a clear bond direction
    const atomBlock = atoms;
    atomBlock.setColF("x", new Float32Array([0, 10]));
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atomBlock, atomColor, 42);
    const data0 = result?.buffers.get("instanceData0")!;
    // Two sub-instances should have same x (midpoint) but different y or z (offset)
    const cx0 = data0[0];
    const cy0 = data0[1];
    const cz0 = data0[2];
    const cx1 = data0[4];
    const cy1 = data0[5];
    const cz1 = data0[6];

    // X should be same (midpoint = 5)
    expect(cx0).toBeCloseTo(cx1, 3);
    // At least one of y/z should differ (offset)
    const offsetDist = Math.sqrt((cy0 - cy1) ** 2 + (cz0 - cz1) ** 2);
    expect(offsetDist).toBeGreaterThan(0.01);
  });

  it("should share picking color for sub-instances of same bond", () => {
    const { atoms, bonds } = makeBlocks(2, [{ i: 0, j: 1, order: 2 }]);
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bonds, atoms, atomColor, 42);
    const pick = result?.buffers.get("instancePickingColor")!;
    // Both sub-instances should have identical picking color
    expect(pick[0]).toBe(pick[4]);
    expect(pick[1]).toBe(pick[5]);
    expect(pick[2]).toBe(pick[6]);
    expect(pick[3]).toBe(pick[7]);
  });

  it("should handle bonds without order column (default to 1)", () => {
    const atoms = new Block();
    atoms.setColF("x", new Float32Array([0, 1]));
    atoms.setColF("y", new Float32Array([0, 0]));
    atoms.setColF("z", new Float32Array([0, 0]));
    const bondsBlock = new Block();
    bondsBlock.setColU32("atomi", new Uint32Array([0]));
    bondsBlock.setColU32("atomj", new Uint32Array([1]));
    // No order column
    const atomColor = makeAtomColor(2);
    const result = buildBondBuffers(bondsBlock, atoms, atomColor, 42);
    expect(result?.instanceCount).toBe(1);
  });
});
