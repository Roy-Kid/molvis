import { describe, expect, it } from "@rstest/core";
import { MoleculeGraph } from "../src/molecule_graph";
import type { MoleculeData } from "../src/types";

const H2O: MoleculeData = {
  atoms: [
    { element: "O", x: 0, y: 0 },
    { element: "H", x: 1, y: 0.5 },
    { element: "H", x: 1, y: -0.5 },
  ],
  bonds: [
    { i: 0, j: 1, order: 1 },
    { i: 0, j: 2, order: 1 },
  ],
};

describe("MoleculeGraph", () => {
  it("loadMoleculeData then getMoleculeData returns deep equal copy", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData(H2O);
    const a = g.getMoleculeData();
    const b = g.getMoleculeData();
    expect(a).toEqual(H2O);
    expect(a).toEqual(b);
    expect(a.atoms).not.toBe(b.atoms);
    expect(a.bonds).not.toBe(b.bonds);
    a.atoms[0].element = "X";
    expect(g.getMoleculeData().atoms[0].element).toBe("O");
  });

  it("toFrame writes BuilderTab columns element atomi atomj order", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData(H2O);
    const frame = g.toFrame();
    try {
      const atoms = frame.getBlock("atoms");
      expect(atoms).toBeDefined();
      expect(atoms?.copyColStr("element")).toEqual(["O", "H", "H"]);
      const bonds = frame.getBlock("bonds");
      expect(bonds).toBeDefined();
      expect(Array.from(bonds?.copyColU32("atomi") ?? [])).toEqual([0, 0]);
      expect(Array.from(bonds?.copyColU32("atomj") ?? [])).toEqual([1, 2]);
      expect(Array.from(bonds?.copyColU32("order") ?? [])).toEqual([1, 1]);
    } finally {
      frame.free();
    }
  });

  it("toFrame omits bonds block when no bonds", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    const frame = g.toFrame();
    try {
      expect(frame.getBlock("atoms")?.nrows()).toBe(1);
      expect(frame.getBlock("bonds")).toBeUndefined();
    } finally {
      frame.free();
    }
  });

  it("toFrame then fromFrame preserves topology", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData(H2O);
    const frame = g.toFrame();
    try {
      const g2 = new MoleculeGraph();
      g2.fromFrame(frame);
      const data = g2.getMoleculeData();
      expect(data.atoms.map((a) => a.element)).toEqual(["O", "H", "H"]);
      expect(data.bonds).toEqual([
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ]);
      // synthetic linear coords
      expect(data.atoms[0].x).toBe(0);
      expect(data.atoms[1].x).toBe(1.4);
      expect(data.atoms[2].x).toBe(2.8);
    } finally {
      frame.free();
    }
  });

  it("loadMoleculeData rejects bond out of range", () => {
    const g = new MoleculeGraph();
    expect(() =>
      g.loadMoleculeData({
        atoms: [{ element: "C", x: 0, y: 0 }],
        bonds: [{ i: 0, j: 1, order: 1 }],
      }),
    ).toThrow();
  });

  it("empty molecule has zero atoms", () => {
    const g = new MoleculeGraph();
    expect(g.getMoleculeData()).toEqual({ atoms: [], bonds: [] });
    expect(g.atomCount()).toBe(0);
  });
});
