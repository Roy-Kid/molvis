import { describe, expect, it } from "@rstest/core";
import { findAtom, SNAP_RADIUS } from "../../src/geometry/snap";
import { MoleculeGraph } from "../../src/molecule_graph";

describe("findAtom", () => {
  it("returns nearest within SNAP_RADIUS", () => {
    const g = new MoleculeGraph();
    g.loadMoleculeData({
      atoms: [{ element: "C", x: 0, y: 0 }],
      bonds: [],
    });
    expect(findAtom(g, 0.1, 0, SNAP_RADIUS)).toBe(0);
    expect(findAtom(g, 1, 0, SNAP_RADIUS)).toBeNull();
  });
});
