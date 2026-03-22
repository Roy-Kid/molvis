import { describe, expect, it } from "@rstest/core";
import { Block, Frame } from "molrs-wasm";
import "./setup_wasm";
import {
  discoverAtomColumns,
  extractAtomRows,
  extractBondRows,
} from "../src/data_inspector";

function makeAtomBlock(
  elements: string[],
  positions: [number, number, number][],
): Block {
  const block = new Block();
  block.setColStr("element", elements);
  block.setColF32("x", new Float32Array(positions.map((p) => p[0])));
  block.setColF32("y", new Float32Array(positions.map((p) => p[1])));
  block.setColF32("z", new Float32Array(positions.map((p) => p[2])));
  return block;
}

describe("discoverAtomColumns", () => {
  it("should discover element, x, y, z columns", () => {
    const block = makeAtomBlock(
      ["C", "O"],
      [
        [0, 0, 0],
        [1, 1, 1],
      ],
    );
    const cols = discoverAtomColumns(block);
    const names = cols.map((c) => c.name);
    expect(names).toContain("element");
    expect(names).toContain("x");
    expect(names).toContain("y");
    expect(names).toContain("z");
  });

  it("should sort element first, then x/y/z", () => {
    const block = makeAtomBlock(["C"], [[1, 2, 3]]);
    const cols = discoverAtomColumns(block);
    expect(cols[0].name).toBe("element");
    expect(cols[1].name).toBe("x");
    expect(cols[2].name).toBe("y");
    expect(cols[3].name).toBe("z");
  });

  it("should skip internal __ columns", () => {
    const block = makeAtomBlock(["C"], [[0, 0, 0]]);
    block.setColF32("__color_r", new Float32Array([1.0]));
    const cols = discoverAtomColumns(block);
    const names = cols.map((c) => c.name);
    expect(names).not.toContain("__color_r");
  });

  it("should include additional columns", () => {
    const block = makeAtomBlock(["C"], [[0, 0, 0]]);
    block.setColF32("charge", new Float32Array([0.5]));
    const cols = discoverAtomColumns(block);
    const names = cols.map((c) => c.name);
    expect(names).toContain("charge");
  });
});

describe("extractAtomRows", () => {
  it("should extract all rows with values", () => {
    const block = makeAtomBlock(
      ["C", "O", "N"],
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    );
    const cols = discoverAtomColumns(block);
    const rows = extractAtomRows(block, cols);
    expect(rows.length).toBe(3);
    expect(rows[0].index).toBe(0);
    expect(rows[0].values.get("element")).toBe("C");
    expect(rows[1].values.get("element")).toBe("O");
    expect(rows[2].values.get("element")).toBe("N");
  });

  it("should format numeric values with 3 decimal places", () => {
    const block = makeAtomBlock(["C"], [[1.23456, 0, 0]]);
    const cols = discoverAtomColumns(block);
    const rows = extractAtomRows(block, cols);
    expect(rows[0].values.get("x")).toBe("1.235");
  });

  it("should support start/count pagination", () => {
    const elements = Array.from({ length: 10 }, () => "C");
    const positions = Array.from(
      { length: 10 },
      (_, i) => [i, 0, 0] as [number, number, number],
    );
    const block = makeAtomBlock(elements, positions);
    const cols = discoverAtomColumns(block);
    const rows = extractAtomRows(block, cols, 3, 4);
    expect(rows.length).toBe(4);
    expect(rows[0].index).toBe(3);
    expect(rows[3].index).toBe(6);
  });

  it("should handle empty block", () => {
    const block = new Block();
    const rows = extractAtomRows(block, []);
    expect(rows.length).toBe(0);
  });
});

describe("extractBondRows", () => {
  it("should extract bond data", () => {
    const frame = new Frame();
    const atoms = makeAtomBlock(
      ["C", "O"],
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
    );
    frame.insertBlock("atoms", atoms);

    const bonds = new Block();
    bonds.setColU32("i", new Uint32Array([0]));
    bonds.setColU32("j", new Uint32Array([1]));
    bonds.setColU32("order", new Uint32Array([2]));
    frame.insertBlock("bonds", bonds);

    const rows = extractBondRows(frame);
    expect(rows.length).toBe(1);
    expect(rows[0].i).toBe(0);
    expect(rows[0].j).toBe(1);
    expect(rows[0].order).toBe(2);
  });

  it("should return empty for frame without bonds", () => {
    const frame = new Frame();
    const rows = extractBondRows(frame);
    expect(rows.length).toBe(0);
  });

  it("should default order to 1 when column missing", () => {
    const frame = new Frame();
    const atoms = makeAtomBlock(
      ["C", "O"],
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
    );
    frame.insertBlock("atoms", atoms);

    const bonds = new Block();
    bonds.setColU32("i", new Uint32Array([0]));
    bonds.setColU32("j", new Uint32Array([1]));
    frame.insertBlock("bonds", bonds);

    const rows = extractBondRows(frame);
    expect(rows[0].order).toBe(1);
  });
});
