/**
 * Regression: OVITO Selection modifier parity (public stage API).
 *
 * Synthetic H–C–H frame; hard-coded selected indices for Clear / Invert /
 * Select Type / Expand. No third-party oracle.
 * Run: npm run test:regressions
 */

import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { ExpandSelectionModifier } from "../stage/src/modifiers/ExpandSelectionModifier";
import { InvertSelectionModifier } from "../stage/src/modifiers/InvertSelectionModifier";
import { ClearSelectionModifier } from "../stage/src/modifiers/SelectModifier";
import { SelectTypeModifier } from "../stage/src/modifiers/SelectTypeModifier";
import {
  createDefaultContext,
  SelectionMask,
} from "../stage/src/pipeline/types";

function hchWithBonds(): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array([0, 1.1, 2.2]));
  atoms.setColF("y", new Float64Array([0, 0, 0]));
  atoms.setColF("z", new Float64Array([0, 0, 0]));
  atoms.setColStr("element", ["H", "C", "H"]);
  frame.insertBlock("atoms", atoms);
  const bonds = new Block();
  bonds.setColU32("atomi", new Uint32Array([0, 1]));
  bonds.setColU32("atomj", new Uint32Array([1, 2]));
  frame.insertBlock("bonds", bonds);
  return frame;
}

describe("regression: ovito-modifier-align Selection", () => {
  it("Clear / Invert / Select Type / Expand hard-coded goldens", () => {
    const frame = hchWithBonds();
    const ctx = createDefaultContext(frame, {} as never);

    // Clear: OVITO empty selection
    ctx.currentSelection = SelectionMask.all(3);
    new ClearSelectionModifier("clear").apply(frame, ctx);
    expect(ctx.currentSelection.getIndices()).toEqual([]);

    // Select Type: carbon only → [1]
    const selectType = new SelectTypeModifier("stype");
    selectType.elements = ["C"];
    selectType.apply(frame, ctx);
    expect(ctx.currentSelection.getIndices()).toEqual([1]);

    // Invert: complement of [1] on 3 atoms → [0, 2]
    new InvertSelectionModifier("inv").apply(frame, ctx);
    expect(ctx.currentSelection.getIndices().sort((a, b) => a - b)).toEqual([
      0, 2,
    ]);

    // Expand bonds from [0]: 1-hop → [0, 1]
    ctx.currentSelection = SelectionMask.fromIndices(3, [0]);
    const expand = new ExpandSelectionModifier("exp");
    expand.mode = "bonds";
    expand.apply(frame, ctx);
    expect(ctx.currentSelection.getIndices().sort((a, b) => a - b)).toEqual([
      0, 1,
    ]);
  });
});
