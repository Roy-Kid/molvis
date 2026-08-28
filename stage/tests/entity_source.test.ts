import { Block, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { toDomainUint } from "@molcrafts/molvis-core";
import { BondSource } from "../src/entity_source";
import { BOND_TYPE_AROMATIC, BOND_TYPE_SINGLE } from "../src/utils/bond_order";

/** Two atoms at (0,0,0) and (1,2,3); one bond 1→0. PerceiveBonds writes only atomi/atomj. */
function diatomicFrame(bondType?: number, bondNumber?: number): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array([0, 1]));
  atoms.setColF("y", new Float64Array([0, 2]));
  atoms.setColF("z", new Float64Array([0, 3]));
  frame.insertBlock("atoms", atoms);

  const bonds = new Block();
  bonds.setColU32("atomi", toDomainUint([1]));
  bonds.setColU32("atomj", toDomainUint([0]));
  if (bondType !== undefined) {
    bonds.setColU32("bond_type", toDomainUint([bondType]));
  }
  if (bondNumber !== undefined) {
    bonds.setColU32("bond_number", toDomainUint([bondNumber]));
  }
  frame.insertBlock("bonds", bonds);
  return frame;
}

describe("BondSource.getMeta", () => {
  // ── Basics ──────────────────────────────────────────────────────────────
  it("does not throw when bonds have only atomi/atomj and defaults to a single bond", () => {
    const src = new BondSource();
    src.setFrame(diatomicFrame());
    expect(() => src.getMeta(0)).not.toThrow();
    expect(src.getMeta(0)).toEqual({
      type: "bond",
      bondId: 0,
      atomId1: 1,
      atomId2: 0,
      bondType: BOND_TYPE_SINGLE,
      bondNumber: BOND_TYPE_SINGLE,
      start: { x: 1, y: 2, z: 3 },
      end: { x: 0, y: 0, z: 0 },
    });
  });

  it("reads bond_type and bond_number when both columns are present", () => {
    const src = new BondSource();
    src.setFrame(diatomicFrame(BOND_TYPE_AROMATIC, 0));
    expect(src.getMeta(0)).toEqual({
      type: "bond",
      bondId: 0,
      atomId1: 1,
      atomId2: 0,
      bondType: BOND_TYPE_AROMATIC,
      bondNumber: 0,
      start: { x: 1, y: 2, z: 3 },
      end: { x: 0, y: 0, z: 0 },
    });
  });

  // ── Edge ────────────────────────────────────────────────────────────────
  it("defaults bondNumber to type for 1–3 when bond_number is absent", () => {
    const src = new BondSource();
    src.setFrame(diatomicFrame(2));
    expect(() => src.getMeta(0)).not.toThrow();
    const meta = src.getMeta(0);
    expect(meta).not.toBeNull();
    expect(meta?.bondType).toBe(2);
    expect(meta?.bondNumber).toBe(2);
    expect(meta?.atomId1).toBe(1);
    expect(meta?.atomId2).toBe(0);
    expect(Number.isFinite(meta?.start.x)).toBe(true);
    expect(Number.isFinite(meta?.end.z)).toBe(true);
  });

  it("defaults bondNumber to 0 for aromatic when bond_number is absent", () => {
    const src = new BondSource();
    src.setFrame(diatomicFrame(BOND_TYPE_AROMATIC));
    expect(() => src.getMeta(0)).not.toThrow();
    const meta = src.getMeta(0);
    expect(meta?.bondType).toBe(BOND_TYPE_AROMATIC);
    expect(meta?.bondNumber).toBe(0);
  });
});
