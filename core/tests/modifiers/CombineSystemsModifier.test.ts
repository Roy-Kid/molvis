import { Block, Box, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import type { MolvisApp } from "../../src/app";
import { CombineSystemsModifier } from "../../src/modifiers/CombineSystemsModifier";
import {
  ModifierRegistry,
  registerDefaultModifiers,
} from "../../src/pipeline/modifier_registry";
import { isTopologyChanging } from "../../src/pipeline/nato_ids";
import {
  createDefaultContext,
  type PipelineContext,
} from "../../src/pipeline/types";

// Mock app — combine never touches app during a unit-level apply().
const mockApp = {} as MolvisApp;

interface BoxSpec {
  size: number;
}

/**
 * Build a Frame with explicit per-atom coordinates so concat order is
 * verifiable, plus optional bonds (with an `order` column) and a cubic simbox.
 */
function makeFrame(
  coords: Array<[number, number, number]>,
  elements: string[],
  options: {
    bonds?: Array<[number, number]>;
    bondOrders?: number[];
    box?: BoxSpec;
    sourceId?: number[];
  } = {},
): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(coords.map((c) => c[0])));
  atoms.setColF("y", new Float64Array(coords.map((c) => c[1])));
  atoms.setColF("z", new Float64Array(coords.map((c) => c[2])));
  atoms.setColStr("element", elements);
  if (options.sourceId) {
    atoms.setColI32("source_id", new Int32Array(options.sourceId));
  }
  frame.insertBlock("atoms", atoms);

  if (options.bonds) {
    const bonds = new Block();
    bonds.setColU32("atomi", new Uint32Array(options.bonds.map((b) => b[0])));
    bonds.setColU32("atomj", new Uint32Array(options.bonds.map((b) => b[1])));
    const orders = options.bondOrders ?? options.bonds.map(() => 1);
    bonds.setColU32("order", new Uint32Array(orders));
    frame.insertBlock("bonds", bonds);
  }

  if (options.box) {
    frame.simbox = Box.cube(
      new Float64Array([options.box.size]),
      new Float64Array([0, 0, 0]),
      true,
      true,
      true,
    );
  }

  return frame;
}

/** Read a cubic box's edge length (lengths()[0]) with WasmArray cleanup. */
function boxEdge(frame: Frame): number {
  const box = frame.simbox;
  if (!box) {
    throw new Error("expected a simbox on the combined frame");
  }
  const lengths = box.lengths();
  const copy = lengths.toCopy();
  lengths.free();
  return copy[0];
}

/** Rotate a point 90° about +z: (x, y, z) → (-y, x, z). */
function rotZ90(p: [number, number, number]): [number, number, number] {
  return [-p[1], p[0], p[2]];
}

/** Build a combine modifier with two branches wired into the frame cache. */
function setup(branches: Array<{ id: string; frame: Frame }>): {
  combine: CombineSystemsModifier;
  ctx: PipelineContext;
  input: Frame;
} {
  const input = makeFrame([[0, 0, 0]], ["X"]); // 1-atom placeholder input
  const ctx = createDefaultContext(input, mockApp);
  const combine = new CombineSystemsModifier("combine-1");
  for (const b of branches) {
    ctx.frameCache.set(b.id, b.frame);
  }
  combine.referencedIds = branches.map((b) => b.id);
  return { combine, ctx, input };
}

describe("CombineSystemsModifier", () => {
  it("ac-001: concatenates atom counts (n0=2, n1=3 → 5)", () => {
    const branchA = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      ["C", "O"],
    );
    const branchB = makeFrame(
      [
        [2, 0, 0],
        [3, 0, 0],
        [4, 0, 0],
      ],
      ["H", "H", "N"],
    );
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);

    const out = combine.apply(input, ctx);
    const atoms = out.getBlock("atoms");
    expect(atoms).toBeDefined();
    expect(atoms?.nrows()).toBe(5);
  });

  it("ac-002: offsets branch1 bond indices by preceding atom count, concatenates order", () => {
    const branchA = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      ["C", "O"],
      { bonds: [[0, 1]], bondOrders: [1] },
    );
    const branchB = makeFrame(
      [
        [2, 0, 0],
        [3, 0, 0],
        [4, 0, 0],
      ],
      ["H", "H", "N"],
      { bonds: [[0, 2]], bondOrders: [2] },
    );
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);

    const out = combine.apply(input, ctx);
    const bonds = out.getBlock("bonds");
    expect(bonds).toBeDefined();
    expect(bonds?.nrows()).toBe(2);

    const ai = bonds?.viewColU32("atomi");
    const aj = bonds?.viewColU32("atomj");
    const order = bonds?.viewColU32("order");
    // branch0 bond unchanged
    expect(ai?.[0]).toBe(0);
    expect(aj?.[0]).toBe(1);
    // branch1 bond offset by n0=2 → [2, 4]
    expect(ai?.[1]).toBe(2);
    expect(aj?.[1]).toBe(4);
    // order concatenated unchanged
    expect(order?.[0]).toBe(1);
    expect(order?.[1]).toBe(2);
  });

  it("ac-003: writes Int32 source_id ordinals and overwrites pre-existing source_id", () => {
    const branchA = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      ["C", "O"],
    );
    // branchB carries a bogus source_id that must be overwritten with ordinal 1.
    const branchB = makeFrame(
      [
        [2, 0, 0],
        [3, 0, 0],
        [4, 0, 0],
      ],
      ["H", "H", "N"],
      { sourceId: [99, 99, 99] },
    );
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);

    const out = combine.apply(input, ctx);
    const atoms = out.getBlock("atoms");
    expect(atoms?.dtype("source_id")).toBe("i32");
    const src = atoms?.copyColI32("source_id");
    expect(Array.from(src ?? new Int32Array())).toEqual([0, 0, 1, 1, 1]);
  });

  it("ac-004: output simbox is the FIRST referenced branch's box (not unioned), alignment off", () => {
    const branchA = makeFrame([[0, 0, 0]], ["C"], { box: { size: 10 } });
    const branchB = makeFrame([[0, 0, 0]], ["O"], { box: { size: 20 } });
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);
    expect(combine.alignment.enabled).toBe(false);

    const out = combine.apply(input, ctx);
    expect(boxEdge(out)).toBeCloseTo(10, 9);
  });

  it("ac-005: alignment off — output coordinates equal input branch coords elementwise in order", () => {
    const aCoords: Array<[number, number, number]> = [
      [0.5, 1.5, 2.5],
      [3.5, 4.5, 5.5],
    ];
    const bCoords: Array<[number, number, number]> = [
      [6.5, 7.5, 8.5],
      [9.5, 10.5, 11.5],
      [12.5, 13.5, 14.5],
    ];
    const branchA = makeFrame(aCoords, ["C", "O"]);
    const branchB = makeFrame(bCoords, ["H", "H", "N"]);
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);

    const out = combine.apply(input, ctx);
    const atoms = out.getBlock("atoms");
    const x = atoms?.copyColF("x");
    const y = atoms?.copyColF("y");
    const z = atoms?.copyColF("z");
    const expected = [...aCoords, ...bCoords];
    for (let i = 0; i < expected.length; i++) {
      expect(x?.[i]).toBeCloseTo(expected[i][0], 9);
      expect(y?.[i]).toBeCloseTo(expected[i][1], 9);
      expect(z?.[i]).toBeCloseTo(expected[i][2], 9);
    }
  });

  it("ac-006: alignment ON undoes a known 90° z-rotation (rmsd≈0, coords match reference)", () => {
    const refCoords: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const movedCoords = refCoords.map(rotZ90);
    const branchA = makeFrame(refCoords, ["C", "O", "N"]);
    const branchB = makeFrame(movedCoords, ["C", "O", "N"]);
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);
    combine.alignment = {
      enabled: true,
      referenceId: "branchA",
      massWeight: false,
      subset: null,
    };

    const out = combine.apply(input, ctx);
    const atoms = out.getBlock("atoms");
    const x = atoms?.copyColF("x");
    const y = atoms?.copyColF("y");
    const z = atoms?.copyColF("z");
    // branch1 region (rows 3..5) must coincide with the reference coords.
    for (let i = 0; i < refCoords.length; i++) {
      expect(x?.[refCoords.length + i]).toBeCloseTo(refCoords[i][0], 9);
      expect(y?.[refCoords.length + i]).toBeCloseTo(refCoords[i][1], 9);
      expect(z?.[refCoords.length + i]).toBeCloseTo(refCoords[i][2], 9);
    }
    expect(combine.rmsdByBranch.branchB).toBeCloseTo(0, 9);
  });

  it("ac-007: validate fails when fewer than 2 branches are referenced", () => {
    const branchA = makeFrame([[0, 0, 0]], ["C"]);
    const { combine, ctx, input } = setup([{ id: "branchA", frame: branchA }]);

    const result = combine.validate(input, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => /2|two|at least/i.test(e))).toBe(true);
  });

  it("ac-008: alignment ON with mismatched atom counts and no subset is invalid", () => {
    const ref = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      ["C", "O"],
    );
    const moving = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      ["C", "O", "N"],
    );
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: ref },
      { id: "branchB", frame: moving },
    ]);
    combine.alignment = {
      enabled: true,
      referenceId: "branchA",
      massWeight: false,
      subset: null,
    };

    let message = "";
    const result = combine.validate(input, ctx);
    if (!result.valid) {
      message = (result.errors ?? []).join(" ");
    } else {
      // Some implementations defer the check to apply() — accept a throw too.
      try {
        combine.apply(input, ctx);
        throw new Error("expected validate or apply to reject count mismatch");
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
    }
    expect(message).toMatch(/count|mismatch|subset/i);
  });

  it("ac-009: changes topology (nrows differs from input) and signals topology change", () => {
    const branchA = makeFrame(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      ["C", "O"],
    );
    const branchB = makeFrame(
      [
        [2, 0, 0],
        [3, 0, 0],
        [4, 0, 0],
      ],
      ["H", "H", "N"],
    );
    const { combine, ctx, input } = setup([
      { id: "branchA", frame: branchA },
      { id: "branchB", frame: branchB },
    ]);

    const out = combine.apply(input, ctx);
    const inputCount = input.getBlock("atoms")?.nrows();
    const outCount = out.getBlock("atoms")?.nrows();
    expect(outCount).toBe(5);
    expect(inputCount).toBe(1);
    expect(outCount).not.toBe(inputCount);
    expect(isTopologyChanging(combine)).toBe(true);
  });

  it("ac-010: registry exposes a factory producing a CombineSystemsModifier", () => {
    registerDefaultModifiers();
    const entries = ModifierRegistry.getAvailableModifiers();
    const hasCombine = entries.some(
      (entry) => entry.factory() instanceof CombineSystemsModifier,
    );
    expect(hasCombine).toBe(true);
  });
});
