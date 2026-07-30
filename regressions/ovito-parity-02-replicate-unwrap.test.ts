/**
 * Regression: Replicate + Unwrap hard-coded goldens (public stage API).
 * Run: npm run test:regressions -- --include 'regressions/ovito-parity-02*'
 */
import { Block, Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { ReplicateModifier } from "../stage/src/modifiers/ReplicateModifier";
import { UnwrapTrajectoriesModifier } from "../stage/src/modifiers/UnwrapTrajectoriesModifier";
import { createDefaultContext } from "../stage/src/pipeline/types";

describe("regression: ovito-parity-02 replicate + unwrap", () => {
  it("Replicate 2×1×1 yields 4 atoms; Unwrap MIC jump → ~11", () => {
    const frame = new Frame();
    const atoms = new Block();
    atoms.setColF("x", new Float64Array([0, 1]));
    atoms.setColF("y", new Float64Array([0, 0]));
    atoms.setColF("z", new Float64Array([0, 0]));
    atoms.setColStr("element", ["H", "C"]);
    frame.insertBlock("atoms", atoms);
    frame.box = Box.cube(10, new Float64Array([0, 0, 0]), true, true, true);

    const rep = new ReplicateModifier("r");
    rep.setCounts(2, 1, 1);
    const out = rep.apply(frame, createDefaultContext(frame, {} as never));
    expect(out.getBlock("atoms")?.nrows()).toBe(4);

    const unwrap = new UnwrapTrajectoriesModifier("u");
    const f0 = new Frame();
    const a0 = new Block();
    a0.setColF("x", new Float64Array([9]));
    a0.setColF("y", new Float64Array([0]));
    a0.setColF("z", new Float64Array([0]));
    a0.setColStr("element", ["C"]);
    f0.insertBlock("atoms", a0);
    f0.box = Box.cube(10, new Float64Array([0, 0, 0]), true, true, true);
    unwrap.apply(f0, createDefaultContext(f0, {} as never, 0));

    const f1 = new Frame();
    const a1 = new Block();
    a1.setColF("x", new Float64Array([1]));
    a1.setColF("y", new Float64Array([0]));
    a1.setColF("z", new Float64Array([0]));
    a1.setColStr("element", ["C"]);
    f1.insertBlock("atoms", a1);
    f1.box = Box.cube(10, new Float64Array([0, 0, 0]), true, true, true);
    const u1 = unwrap.apply(f1, createDefaultContext(f1, {} as never, 1));
    expect(u1.getBlock("atoms")?.viewColF("x")?.[0]).toBeCloseTo(11, 4);
  });
});
