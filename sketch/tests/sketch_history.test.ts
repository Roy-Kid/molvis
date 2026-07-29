import { describe, expect, it } from "@rstest/core";
import { AddAtomCommand } from "../src/commands/edit_commands";
import { MoleculeGraph } from "../src/molecule_graph";
import { SketchHistory } from "../src/sketch_history";

describe("SketchHistory", () => {
  it("execute then canUndo; undo/redo stack semantics", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);

    h.execute(new AddAtomCommand(g, { element: "C", x: 0, y: 0 }));
    expect(g.atomCount()).toBe(1);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);

    expect(h.undo()).toBe(true);
    expect(g.atomCount()).toBe(0);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);

    expect(h.redo()).toBe(true);
    expect(g.atomCount()).toBe(1);
  });

  it("empty stack undo/redo return false", () => {
    const h = new SketchHistory();
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
  });

  it("execute after undo clears redo", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    h.execute(new AddAtomCommand(g, { element: "C", x: 0, y: 0 }));
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.execute(new AddAtomCommand(g, { element: "N", x: 1, y: 0 }));
    expect(h.canRedo()).toBe(false);
    expect(g.getMoleculeData().atoms.map((a) => a.element)).toEqual(["N"]);
  });

  it("clearHistory drops stacks", () => {
    const g = new MoleculeGraph();
    const h = new SketchHistory();
    h.execute(new AddAtomCommand(g, { element: "C", x: 0, y: 0 }));
    h.clearHistory();
    expect(h.canUndo()).toBe(false);
    expect(g.atomCount()).toBe(1);
  });
});
