import { Block } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import type { AtomMeta, BondMeta } from "../../src/entity_source";
import { formatHitInfo } from "../../src/mode/hit_info";

function atomHit(
  atomId: number,
  element: string,
  position: { x: number; y: number; z: number },
): { type: "atom"; metadata: AtomMeta } {
  return {
    type: "atom",
    metadata: { type: "atom", atomId, element, position },
  };
}

function xyzBlock(x: number, y: number, z: number): Block {
  const atoms = new Block();
  atoms.setColF("x", new Float64Array([x]));
  atoms.setColF("y", new Float64Array([y]));
  atoms.setColF("z", new Float64Array([z]));
  return atoms;
}

describe("formatHitInfo", () => {
  // ── Basics ──────────────────────────────────────────────────────────────
  it("formats an atom with element and u32 id as Atom {id} · {element} · XYZ", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    const line = formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms);
    expect(line).toBe("Atom 7 · C · XYZ (1.00, 2.00, 3.00)");
    expect(line).not.toContain("Å");
  });

  it("uses type_id as species when element is missing and never prints Atom Atom", () => {
    const atoms = xyzBlock(0, 0, 0);
    atoms.setColU32("id", new Uint32Array([1]));
    atoms.setColU32("type_id", new Uint32Array([2]));
    const line = formatHitInfo(atomHit(0, "", { x: 0, y: 0, z: 0 }), atoms);
    expect(line).toBe("Atom 1 · 2 · XYZ (0.00, 0.00, 0.00)");
    expect(line).not.toContain("Atom Atom");
  });

  it("appends public extras in keys() order and omits ColorByProperty internals", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    atoms.setColF("charge", new Float64Array([-0.83]));
    atoms.setColF("mass", new Float64Array([12.01]));
    atoms.setColF("__color_r", new Float64Array([0.1]));
    atoms.setColF("__color_g", new Float64Array([0.2]));
    atoms.setColF("__color_b", new Float64Array([0.3]));
    atoms.setColF("xu", new Float64Array([10]));
    atoms.setColF("yu", new Float64Array([20]));
    atoms.setColF("zu", new Float64Array([30]));
    const line = formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms);
    expect(line).toBe(
      "Atom 7 · C · XYZ (1.00, 2.00, 3.00) · charge -0.83 · mass 12.01",
    );
    expect(line).not.toContain("__color");
    expect(line).not.toContain(" · xu ");
    expect(line).not.toContain(" · yu ");
    expect(line).not.toContain(" · zu ");
    expect(line).not.toMatch(/e[+-]?\d/i);
  });

  it("returns an empty string for an empty hit", () => {
    expect(formatHitInfo({ type: "empty" })).toBe("");
  });

  it("returns an empty string for a null hit", () => {
    expect(formatHitInfo(null)).toBe("");
  });

  it("formats a ribbon residue line", () => {
    expect(
      formatHitInfo({
        type: "ribbon",
        chainId: "B",
        resName: "ALA",
        resSeq: 42,
      }),
    ).toBe("Residue ALA 42 · chain B");
  });

  it("formats a bond with length in Å and formatBondLabel kind", () => {
    const metadata: BondMeta = {
      type: "bond",
      bondId: 0,
      atomId1: 0,
      atomId2: 1,
      bondType: 1,
      bondNumber: 1,
      start: { x: 0, y: 0, z: 0 },
      end: { x: 3, y: 4, z: 0 },
    };
    expect(formatHitInfo({ type: "bond", metadata })).toBe(
      "Bond 0–1 · 5.00 Å · single",
    );
  });

  // ── Edge ────────────────────────────────────────────────────────────────
  it("falls back to metadata.atomId when the atoms block has no id column", () => {
    expect(formatHitInfo(atomHit(7, "C", { x: 1, y: 2, z: 3 }))).toBe(
      "Atom 7 · C · XYZ (1.00, 2.00, 3.00)",
    );
  });

  it("uses the type string as species when element is empty", () => {
    const atoms = xyzBlock(0, 0, 0);
    atoms.setColU32("id", new Uint32Array([1]));
    atoms.setColStr("element", ["  "]);
    atoms.setColStr("type", ["CT"]);
    atoms.setColU32("type_id", new Uint32Array([9]));
    expect(formatHitInfo(atomHit(0, "  ", { x: 0, y: 0, z: 0 }), atoms)).toBe(
      "Atom 1 · CT · XYZ (0.00, 0.00, 0.00)",
    );
  });

  it("omits the species slot when element, type, and type_id are all empty", () => {
    const atoms = xyzBlock(0, 0, 0);
    atoms.setColU32("id", new Uint32Array([5]));
    const line = formatHitInfo(atomHit(0, "", { x: 0, y: 0, z: 0 }), atoms);
    expect(line).toBe("Atom 5 · XYZ (0.00, 0.00, 0.00)");
    expect(line).not.toContain(" · · ");
    expect(line).not.toContain("Atom Atom");
  });

  it("prefixes residue name, id, and chain when res_name and res_id exist", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    atoms.setColStr("res_name", ["THR"]);
    atoms.setColU32("res_id", new Uint32Array([222]));
    expect(formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms)).toBe(
      "THR 222 · chain A · Atom 7 · C · XYZ (1.00, 2.00, 3.00)",
    );
  });

  it("skips residue columns from extras when the residue prefix is shown", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    atoms.setColStr("res_name", ["THR"]);
    atoms.setColU32("res_id", new Uint32Array([222]));
    atoms.setColStr("chain_id", ["A"]);
    atoms.setColF("charge", new Float64Array([-0.83]));
    const line = formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms);
    expect(line).toBe(
      "THR 222 · chain A · Atom 7 · C · XYZ (1.00, 2.00, 3.00) · charge -0.83",
    );
    expect(line).not.toContain("res_name");
    expect(line).not.toContain("res_id");
    expect(line).not.toContain("chain_id");
  });

  it("includes res_name as an extra when the residue prefix cannot be shown", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    atoms.setColStr("res_name", ["THR"]);
    expect(formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms)).toBe(
      "Atom 7 · C · XYZ (1.00, 2.00, 3.00) · res_name THR",
    );
  });

  it("uses an explicit chain_id in the residue prefix", () => {
    const atoms = xyzBlock(1, 2, 3);
    atoms.setColStr("element", ["C"]);
    atoms.setColU32("id", new Uint32Array([7]));
    atoms.setColStr("res_name", ["THR"]);
    atoms.setColU32("res_id", new Uint32Array([222]));
    atoms.setColStr("chain_id", [" B "]);
    expect(formatHitInfo(atomHit(0, "C", { x: 1, y: 2, z: 3 }), atoms)).toBe(
      "THR 222 · chain B · Atom 7 · C · XYZ (1.00, 2.00, 3.00)",
    );
  });

  it("formats an aromatic bond via formatBondLabel", () => {
    const metadata: BondMeta = {
      type: "bond",
      bondId: 3,
      atomId1: 4,
      atomId2: 5,
      bondType: 4,
      bondNumber: 0,
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1, y: 0, z: 0 },
    };
    expect(formatHitInfo({ type: "bond", metadata })).toBe(
      "Bond 4–5 · 1.00 Å · aromatic",
    );
  });
});
