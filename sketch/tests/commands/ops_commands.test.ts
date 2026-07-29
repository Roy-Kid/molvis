import { describe, expect, it } from "@rstest/core";
import {
  AdjustAtomChargeCommand,
  ClearDocumentCommand,
  CycleBondOrderCommand,
  MoveSelectionCommand,
  PlaceRingCommand,
  SetBondStereoCommand,
} from "../../src/commands/ops_commands";
import { MoleculeGraph } from "../../src/molecule_graph";
import { SketchHistory } from "../../src/sketch_history";

describe("ops commands", () => {
  it("PlaceRingCommand places 6 atoms for benzene on empty graph", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    h.execute(new PlaceRingCommand(g, 6, 0, 0, 1, "benzene"));
    expect(g.atomCount()).toBe(6);
    expect(g.bondCount()).toBe(6);
    h.undo();
    expect(g.atomCount()).toBe(0);
  });

  it("CycleBondOrderCommand cycles 1→2→3→1 and clears stereo", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1, stereo: "up" }],
    });
    const h = new SketchHistory();
    h.execute(new CycleBondOrderCommand(g, 0));
    expect(g.getBond(0).order).toBe(2);
    expect(g.getBond(0).stereo).toBe("none");
  });

  it("SetBondStereoCommand only on single bonds", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    new SetBondStereoCommand(g, 0, "down").do();
    expect(g.getBond(0).stereo).toBe("down");
  });

  it("AdjustAtomChargeCommand 0→+1→+2→+1", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [{ element: "N", x: 0, y: 0 }],
      bonds: [],
    });
    const h = new SketchHistory();
    h.execute(new AdjustAtomChargeCommand(g, 0, 1));
    h.execute(new AdjustAtomChargeCommand(g, 0, 1));
    expect(g.getAtom(0).charge).toBe(2);
    h.execute(new AdjustAtomChargeCommand(g, 0, -1));
    expect(g.getAtom(0).charge).toBe(1);
  });

  it("MoveSelectionCommand undo restores coords", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [],
    });
    const h = new SketchHistory();
    h.execute(new MoveSelectionCommand(g, [0, 1], 1, 0));
    expect(g.getAtom(0).x).toBeCloseTo(1, 8);
    h.undo();
    expect(g.getAtom(0).x).toBeCloseTo(0, 8);
  });

  it("ClearDocumentCommand empties and undoes", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    const h = new SketchHistory();
    h.execute(new ClearDocumentCommand(g));
    expect(g.atomCount()).toBe(0);
    h.undo();
    expect(g.atomCount()).toBe(1);
  });
});
