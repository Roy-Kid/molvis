import { describe, expect, it } from "@rstest/core";
import {
  AddAtomCommand,
  AddBondCommand,
  RemoveAtomCommand,
  RemoveBondCommand,
} from "../../src/commands/edit_commands";
import { MoleculeGraph } from "../../src/molecule_graph";
import { SketchHistory } from "../../src/sketch_history";

describe("edit commands", () => {
  it("AddAtom do/undo restores atom count", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    h.execute(new AddAtomCommand(g, { element: "O", x: 0, y: 0 }));
    expect(g.atomCount()).toBe(1);
    h.undo();
    expect(g.atomCount()).toBe(0);
    h.redo();
    expect(g.getMoleculeData().atoms[0].element).toBe("O");
  });

  it("AddBond do/undo restores bonds", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    h.execute(new AddAtomCommand(g, { element: "C", x: 0, y: 0 }));
    h.execute(new AddAtomCommand(g, { element: "O", x: 1, y: 0 }));
    h.execute(new AddBondCommand(g, { i: 0, j: 1, order: 2 }));
    expect(g.bondCount()).toBe(1);
    expect(g.getMoleculeData().bonds[0].order).toBe(2);
    h.undo();
    expect(g.bondCount()).toBe(0);
    h.redo();
    expect(g.bondCount()).toBe(1);
  });

  it("RemoveAtom deletes incident bonds and remaps indices", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "O", x: 1, y: 0 },
        { element: "N", x: 2, y: 0 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 1, j: 2, order: 1 },
      ],
    });
    const h = new SketchHistory();
    h.execute(new RemoveAtomCommand(g, 1));
    const data = g.getMoleculeData();
    expect(data.atoms.map((a) => a.element)).toEqual(["C", "N"]);
    expect(data.bonds).toEqual([]);
    h.undo();
    expect(g.getMoleculeData().atoms.map((a) => a.element)).toEqual([
      "C",
      "O",
      "N",
    ]);
    expect(g.bondCount()).toBe(2);
  });

  it("RemoveBond do/undo restores bond at index", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
        { element: "C", x: 2, y: 0 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 1, j: 2, order: 1 },
      ],
    });
    const h = new SketchHistory();
    h.execute(new RemoveBondCommand(g, 0));
    expect(g.bondCount()).toBe(1);
    expect(g.getMoleculeData().bonds[0]).toEqual({ i: 1, j: 2, order: 1 });
    h.undo();
    expect(g.bondCount()).toBe(2);
    expect(g.getMoleculeData().bonds[0]).toEqual({ i: 0, j: 1, order: 1 });
  });

  it("AddBond rejects self-bond and bad index", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    expect(() =>
      new AddBondCommand(g, { i: 0, j: 0, order: 1 }).do(),
    ).toThrow();
    expect(() =>
      new AddBondCommand(g, { i: 0, j: 1, order: 1 }).do(),
    ).toThrow();
  });
});
