import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { toDomainUint } from "@molcrafts/molvis-core";
import { buildStructureOutline } from "../../src/system/structure_outline";

describe("buildStructureOutline", () => {
  it("builds chain → residue → atom when columns exist", () => {
    const frame = new Frame();
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0, 1, 2]));
    atoms.setColF("y", new Float64Array([0, 0, 0]));
    atoms.setColF("z", new Float64Array([0, 0, 0]));
    atoms.setColStr("element", ["N", "CA", "C"]);
    atoms.setColStr("name", ["N", "CA", "C"]);
    atoms.setColStr("chain_id", ["A", "A", "A"]);
    atoms.setColU32("res_id", toDomainUint([1, 1, 1]));
    atoms.setColStr("res_name", ["ALA", "ALA", "ALA"]);
    frame.insertBlock("atoms", atoms);

    const outline = buildStructureOutline(frame);
    expect(outline.roots).toHaveLength(1);
    expect(outline.roots[0].kind).toBe("chain");
    expect(outline.roots[0].label).toContain("A");
    expect(outline.roots[0].children).toHaveLength(1);
    expect(outline.roots[0].children?.[0].kind).toBe("residue");
    // The chain owns no atoms of its own — the residue under it does.
    expect(outline.roots[0].atomIndices).toBeUndefined();
    expect(outline.roots[0].atomCount).toBe(3);
    expect(outline.roots[0].children?.[0].atomIndices).toEqual([0, 1, 2]);
  });

  it("returns empty roots for empty frame", () => {
    expect(buildStructureOutline(new Frame()).roots).toEqual([]);
  });

  it("lists atoms flat when there is no res_id (LAMMPS data)", () => {
    const frame = new Frame();
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0, 1]));
    atoms.setColF("y", new Float64Array([0, 0]));
    atoms.setColF("z", new Float64Array([0, 0]));
    atoms.setColU32("type_id", toDomainUint([1, 2]));
    frame.insertBlock("atoms", atoms);

    const outline = buildStructureOutline(frame);
    expect(outline.roots).toHaveLength(1);
    expect(outline.roots[0].kind).toBe("source");
    expect(outline.roots[0].children).toHaveLength(2);
  });

  it("does not consume res_seq — ribbon-only field stays unread", () => {
    const frame = new Frame();
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0]));
    atoms.setColF("y", new Float64Array([0]));
    atoms.setColF("z", new Float64Array([0]));
    atoms.setColI32("res_seq", new Int32Array([7]));
    frame.insertBlock("atoms", atoms);

    const outline = buildStructureOutline(frame);
    expect(outline.roots[0].kind).toBe("source");
    expect(outline.roots[0].children?.[0].kind).toBe("atom");
  });

  it("covers a flat frame with a range instead of an index per atom", () => {
    const n = 5000;
    const frame = new Frame();
    const atoms = new Block();
    const zeros = new Float64Array(n);
    atoms.setColF("x", zeros);
    atoms.setColF("y", zeros);
    atoms.setColF("z", zeros);
    atoms.setColU32(
      "type_id",
      toDomainUint(Array.from({ length: n }, () => 1)),
    );
    frame.insertBlock("atoms", atoms);

    const outline = buildStructureOutline(frame, { maxAtomsListed: 100 });
    const root = outline.roots[0];
    expect(root.label).toContain(`${n}`);
    // 5000 indices would cross the host channel on every publish, for a click
    // that selects the whole system. Two numbers say the same thing.
    expect(root.atomIndices).toBeUndefined();
    expect(root.atomRange).toEqual({ start: 0, end: n });
    expect(root.atomCount).toBe(n);
    expect(root.children).toHaveLength(100);
    expect(root.children?.[0].atomIndices).toEqual([0]);
  });

  it("uses a range for a small flat frame too — one rule, not a threshold", () => {
    const frame = new Frame();
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0, 1]));
    atoms.setColF("y", new Float64Array([0, 0]));
    atoms.setColF("z", new Float64Array([0, 0]));
    atoms.setColU32("type_id", toDomainUint([1, 2]));
    frame.insertBlock("atoms", atoms);

    const root = buildStructureOutline(frame).roots[0];
    expect(root.atomIndices).toBeUndefined();
    expect(root.atomRange).toEqual({ start: 0, end: 2 });
    expect(root.children?.map((c) => c.atomIndices)).toEqual([[0], [1]]);
  });
});
