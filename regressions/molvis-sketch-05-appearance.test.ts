/**
 * Public sketch appearance golden added for custom color support
 * (2026-07-29). Values are intentionally literal and do not use renderer
 * internals.
 */

import {
  CompositeCommand,
  SetAtomColorCommand,
  SetBondColorCommand,
  SketchBoard,
} from "@molcrafts/molvis-sketch";
import { describe, expect, it } from "@rstest/core";

describe("molvis-sketch appearance public API", () => {
  it("retains object colors while one undo restores defaults", () => {
    const board = new SketchBoard();
    board.loadMoleculeData({
      atoms: [
        { element: "N", x: 0, y: 0 },
        { element: "O", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
    board.history.execute(
      new CompositeCommand([
        new SetAtomColorCommand(board.graph, 0, "#7c3aed"),
        new SetBondColorCommand(board.graph, 0, "#008000"),
      ]),
    );
    expect(board.getMoleculeData()).toEqual({
      atoms: [
        { element: "N", x: 0, y: 0, color: "#7c3aed" },
        { element: "O", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1, color: "#008000" }],
    });
    board.undo();
    expect(board.getMoleculeData()).toEqual({
      atoms: [
        { element: "N", x: 0, y: 0 },
        { element: "O", x: 1, y: 0 },
      ],
      bonds: [{ i: 0, j: 1, order: 1 }],
    });
  });
});
