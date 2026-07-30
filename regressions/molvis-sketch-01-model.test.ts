/**
 * Public-API regression for @molcrafts/molvis-sketch model layer.
 * Goldens: hand-derived H2O topology + BuilderTab Frame columns (2026-07-29).
 * No legacy editor, generate3D, or third-party oracle at runtime.
 */
import { describe, expect, it } from "@rstest/core";
import {
  AddAtomCommand,
  MoleculeGraph,
  SketchHistory,
} from "../sketch/src/index";

describe("molvis-sketch-01-model regression", () => {
  it("H2O Frame columns and history", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [
        { element: "O", x: 0, y: 0 },
        { element: "H", x: 0.96, y: 0 },
        { element: "H", x: -0.24, y: 0.93 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ],
    });

    const frame = g.toFrame();
    try {
      expect(frame.getBlock("atoms")?.copyColStr("element")).toEqual([
        "O",
        "H",
        "H",
      ]);
      const bonds = frame.getBlock("bonds");
      expect(Array.from(bonds?.copyColU32("atomi") ?? [])).toEqual([0, 0]);
      expect(Array.from(bonds?.copyColU32("atomj") ?? [])).toEqual([1, 2]);
      // generate3D requires float bond order; u32 is mis-read as 0
      expect(Array.from(bonds?.copyColF("order") ?? [])).toEqual([1, 1]);

      const g2 = new MoleculeGraph();
      g2.fromFrame(frame);
      expect(g2.getMoleculeData().atoms.map((a) => a.element)).toEqual([
        "O",
        "H",
        "H",
      ]);
      expect(g2.getMoleculeData().bonds).toEqual([
        { i: 0, j: 1, order: 1 },
        { i: 0, j: 2, order: 1 },
      ]);
    } finally {
      frame.free();
    }

    const h = new SketchHistory();
    const before = g.atomCount();
    h.execute(new AddAtomCommand(g, { element: "C", x: 3, y: 0 }));
    expect(g.atomCount()).toBe(before + 1);
    h.undo();
    expect(g.atomCount()).toBe(before);
  });
});
