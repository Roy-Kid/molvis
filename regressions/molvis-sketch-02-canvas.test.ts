/**
 * Public-API regression for SketchBoard canvas layer.
 * Goldens: water topology + bond-chain step 1.2 (2026-07-29).
 */
import { describe, expect, it } from "@rstest/core";
import {
  PlaceChainCommand,
  SketchBoard,
  SketchHistory,
} from "../sketch/src/index";

describe("molvis-sketch-02-canvas regression", () => {
  it("water multiset and chain step goldens", () => {
    const board = new SketchBoard({ bondChainStep: 1.2 });
    board.loadMoleculeData({
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
    const data = board.getMoleculeData();
    expect(data.atoms).toHaveLength(3);
    expect(data.bonds).toHaveLength(2);
    expect(data.atoms.map((a) => a.element).sort()).toEqual(["H", "H", "O"]);

    const frame = board.toFrame();
    try {
      expect(frame.getBlock("atoms")?.nrows()).toBe(3);
      expect(frame.getBlock("bonds")?.nrows()).toBe(2);
    } finally {
      frame.free();
    }

    const board2 = new SketchBoard({ bondChainStep: 1.2 });
    board2.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    const h = new SketchHistory();
    h.execute(
      new PlaceChainCommand(board2.graph, 0, 2.4, 0, 1.2, 1),
    );
    const chain = board2.getMoleculeData();
    expect(chain.atoms).toHaveLength(3);
    expect(chain.bonds).toHaveLength(2);
    expect(chain.atoms[1].x - chain.atoms[0].x).toBeCloseTo(1.2, 6);
    h.undo();
    expect(board2.getMoleculeData().atoms).toHaveLength(1);
  });
});
