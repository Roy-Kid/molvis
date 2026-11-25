import { describe, expect, it } from "@rstest/core";
import { snapMovedBond } from "../../src/board/bond_snap";
import type { MoleculeData } from "../../src/types";

describe("snapMovedBond", () => {
  it("replaces the free carbon tip with the label and leaves a connected anchor fixed", () => {
    const data: MoleculeData = {
      atoms: [
        { element: "C", x: -1, y: 0 },
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
        { element: "N", label: "CN", x: 1.15, y: 0 },
      ],
      bonds: [
        { i: 0, j: 1, order: 1 },
        { i: 1, j: 2, order: 1, color: "#202332" },
      ],
    };
    const attached = snapMovedBond(
      data,
      { kind: "bond", index: 1 },
      0.65,
      0,
      { x: 1.15, y: 0 },
      0.7,
      0.12,
    );
    expect(attached?.atoms).toEqual([
      data.atoms[0],
      data.atoms[1],
      data.atoms[3],
    ]);
    expect(attached?.bonds).toEqual([
      data.bonds[0],
      { i: 1, j: 2, order: 1, color: "#202332" },
    ]);
    expect(data.atoms[2].element).toBe("C");
    expect(data.atoms).toHaveLength(4);
  });

  it("retains the length and order of a loose bond when its end snaps", () => {
    const data: MoleculeData = {
      atoms: [
        { element: "N", label: "CN", x: 4, y: 0 },
        { element: "C", x: 0, y: 0 },
        { element: "C", x: 1, y: 0 },
      ],
      bonds: [{ i: 1, j: 2, order: 2 }],
    };
    expect(
      snapMovedBond(
        data,
        { kind: "bond", index: 0 },
        2.8,
        0,
        { x: 3.3, y: 0 },
        0.7,
        0.12,
      ),
    ).toEqual({
      atoms: [data.atoms[0], { ...data.atoms[1], x: 3 }],
      bonds: [{ i: 1, j: 0, order: 2 }],
    });
  });
});
