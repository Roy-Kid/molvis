/**
 * ChemDraw-ops public API goldens (2026-07-29).
 */
import { describe, expect, it } from "@rstest/core";
import {
  AdjustAtomChargeCommand,
  CycleBondOrderCommand,
  PlaceChainCommand,
  PlaceRingCommand,
  SetBondStereoCommand,
  SketchBoard,
  SketchHistory,
} from "../sketch/src/index";

describe("molvis-sketch-03-ops regression", () => {
  it("benzene + chain + order + stereo + charge", () => {
    const board = new SketchBoard();
    const h = new SketchHistory();
    h.execute(new PlaceRingCommand(board.graph, 6, 0, 0, undefined, "benzene"));
    expect(board.graph.atomCount()).toBe(6);
    expect(board.graph.getMoleculeData().bonds.map((b) => b.order)).toEqual([
      2, 1, 2, 1, 2, 1,
    ]);

    // extend from atom 0 along +x by 2*1.2
    h.execute(new PlaceChainCommand(board.graph, 0, 2.4, 0, 1.2, 1));
    expect(board.graph.atomCount()).toBe(8);

    // cycle first bond
    h.execute(new CycleBondOrderCommand(board.graph, 0));
    expect(
      board.graph.getMoleculeData().bonds.filter((b) => b.order === 2),
    ).toHaveLength(2);

    // stereo on a single bond (find one with order 1)
    const bonds = board.graph.getMoleculeData().bonds;
    const singleIdx = bonds.findIndex((b) => b.order === 1);
    expect(singleIdx).toBeGreaterThanOrEqual(0);
    h.execute(new SetBondStereoCommand(board.graph, singleIdx, "up"));
    expect(
      board.graph.getMoleculeData().bonds.filter((b) => b.stereo === "up"),
    ).toHaveLength(1);

    h.execute(new AdjustAtomChargeCommand(board.graph, 0, 1));
    expect(board.graph.getAtom(0).charge).toBe(1);
    h.undo();
    expect(board.graph.getAtom(0).charge ?? 0).toBe(0);
  });
});
