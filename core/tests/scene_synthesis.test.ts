/**
 * Scene synthesis — pure-module tests.
 *
 * Module under test:
 *   `core/src/system/scene_synthesis.ts`
 *
 *   type SynthesisSource    = { id: string; trajectory: Trajectory };
 *   type SynthesisAlignment = { enabled: boolean; massWeight: boolean; subset: Uint32Array | null };
 *   type SceneSynthesisConfig = {
 *     mode: "extend" | "augment";
 *     referenceId: string | null;
 *     alignment: SynthesisAlignment | null;
 *   };
 *   synthesize(
 *     sources: SynthesisSource[],
 *     frameIndex: number,
 *     config: SceneSynthesisConfig,
 *   ): Promise<Frame>
 *
 * `synthesize` is async because it resolves each source's
 * `trajectory.frame(index)` (which is async). Tests always `await` it.
 *
 * Acceptance criteria: ac-001 … ac-010 (data-source-synthesis-03 spec).
 *
 * Determinism: every fixture is a fixed literal (no Math.random, no clock).
 * Rotations are exact closed-form matrices. FP comparisons use the
 * "position" numerical tolerance column (1e-6) for alignment/rmsd, and
 * exact-match for integer columns (source_id, bond indices).
 */

import { Block, Box, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import {
  type SceneSynthesisConfig,
  type SynthesisAlignment,
  type SynthesisSource,
  synthesize,
} from "../src/system/scene_synthesis";
import { Trajectory } from "../src/system/trajectory";

// ── Fixtures / helpers ──────────────────────────────────────────────────────

interface BoxSpec {
  size: number;
}

/**
 * Build a Frame with explicit per-atom coordinates so concat order and
 * per-frame zip are verifiable, plus optional bonds (with an `order`
 * column), a cubic simbox, a `mass` column, and an arbitrary extra block.
 */
function makeFrame(
  coords: Array<[number, number, number]>,
  elements: string[],
  options: {
    bonds?: Array<[number, number]>;
    bondOrders?: number[];
    box?: BoxSpec;
    sourceId?: number[];
    mass?: number[];
    extraBlock?: { name: string; col: string; values: number[] };
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
  if (options.mass) {
    atoms.setColF("mass", new Float64Array(options.mass));
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

  if (options.extraBlock) {
    const extra = new Block();
    extra.setColF(
      options.extraBlock.col,
      new Float64Array(options.extraBlock.values),
    );
    frame.insertBlock(options.extraBlock.name, extra);
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

/** A SynthesisSource wrapping one or more frames as a Trajectory. */
function makeSource(id: string, frames: Frame[]): SynthesisSource {
  return { id, trajectory: new Trajectory(frames) };
}

/** Rotate a point 90° about +z: (x, y, z) → (-y, x, z). Exact integers. */
function rotZ90(p: [number, number, number]): [number, number, number] {
  return [-p[1], p[0], p[2]];
}

// Position-scale numerical tolerance column.
const POS_TOL = 1e-6;

// ── ac-001 extend: concat + source_id + bond offset ───────────────────────────

describe("synthesize (ac-001 extend concat)", () => {
  it("ac-001 two sources (3 + 2 atoms) → nrows 5, source_id [0,0,0,1,1], bond (0,1)→(3,4)", async () => {
    const sourceA = makeSource("a", [
      makeFrame(
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        ["C", "O", "N"],
        { bonds: [[0, 1]], bondOrders: [1] },
      ),
    ]);
    const sourceB = makeSource("b", [
      makeFrame(
        [
          [3, 0, 0],
          [4, 0, 0],
        ],
        ["H", "H"],
        { bonds: [[0, 1]], bondOrders: [1] },
      ),
    ]);
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };

    const out = await synthesize([sourceA, sourceB], 0, config);
    const atoms = out.getBlock("atoms");
    expect(atoms?.nrows()).toBe(5);

    const src = atoms?.copyColI32("source_id");
    expect(Array.from(src ?? new Int32Array())).toEqual([0, 0, 0, 1, 1]);

    const bonds = out.getBlock("bonds");
    expect(bonds?.nrows()).toBe(2);
    const ai = bonds?.viewColU32("atomi");
    const aj = bonds?.viewColU32("atomj");
    // source-0 bond unchanged
    expect(ai?.[0]).toBe(0);
    expect(aj?.[0]).toBe(1);
    // source-1 bond offset by n0=3 → (3, 4)
    expect(ai?.[1]).toBe(3);
    expect(aj?.[1]).toBe(4);
  });
});

// ── ac-002 augment: union blocks, last-wins, no source_id ─────────────────────

describe("synthesize (ac-002 augment union last-wins)", () => {
  it("ac-002 two same-atom-set sources sharing a block name → later wins, count unchanged, no source_id", async () => {
    const sharedCoords: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    const sourceA = makeSource("a", [
      makeFrame(sharedCoords, ["C", "O"], {
        extraBlock: { name: "grid", col: "density", values: [10, 11] },
      }),
    ]);
    const sourceB = makeSource("b", [
      makeFrame(sharedCoords, ["C", "O"], {
        extraBlock: { name: "grid", col: "density", values: [20, 21] },
      }),
    ]);
    const config: SceneSynthesisConfig = {
      mode: "augment",
      referenceId: null,
      alignment: null,
    };

    const out = await synthesize([sourceA, sourceB], 0, config);
    const atoms = out.getBlock("atoms");
    // augment unions; atom count stays the shared count, not concatenated.
    expect(atoms?.nrows()).toBe(2);
    // no source_id column injected in augment mode
    expect(atoms?.dtype("source_id")).toBeUndefined();
    // last source wins the conflicting "grid" block
    const grid = out.getBlock("grid");
    const density = grid?.copyColF("density");
    expect(density?.[0]).toBeCloseTo(20, 9);
    expect(density?.[1]).toBeCloseTo(21, 9);
  });
});

// ── ac-003 broadcast: length-1 source contributes frame(0) at every index ─────

describe("synthesize (ac-003 broadcast length-1)", () => {
  it("ac-003 length-1 source + length-3 source → the length-1 frame appears at index 0/1/2", async () => {
    const staticFrame = makeFrame([[7, 7, 7]], ["S"]);
    const sourceA = makeSource("a", [staticFrame]); // length 1
    const sourceB = makeSource("b", [
      makeFrame([[0, 0, 0]], ["B"]),
      makeFrame([[0, 0, 1]], ["B"]),
      makeFrame([[0, 0, 2]], ["B"]),
    ]); // length 3
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };

    for (const idx of [0, 1, 2]) {
      const out = await synthesize([sourceA, sourceB], idx, config);
      const atoms = out.getBlock("atoms");
      const x = atoms?.copyColF("x");
      const z = atoms?.copyColF("z");
      // row 0 = broadcast static source frame(0) at every index
      expect(x?.[0]).toBeCloseTo(7, 9);
      // row 1 = source B's frame(idx): z advances 0,1,2
      expect(z?.[1]).toBeCloseTo(idx, 9);
    }
  });
});

// ── ac-004 zip: two length-3 sources contribute frame(k) each ─────────────────

describe("synthesize (ac-004 zip per-frame)", () => {
  it("ac-004 two length-3 sources at frameIndex=k → each contributes its frame(k)", async () => {
    const sourceA = makeSource("a", [
      makeFrame([[0, 0, 0]], ["A"]),
      makeFrame([[10, 0, 0]], ["A"]),
      makeFrame([[20, 0, 0]], ["A"]),
    ]);
    const sourceB = makeSource("b", [
      makeFrame([[0, 0, 0]], ["B"]),
      makeFrame([[0, 100, 0]], ["B"]),
      makeFrame([[0, 200, 0]], ["B"]),
    ]);
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };

    for (const k of [0, 1, 2]) {
      const out = await synthesize([sourceA, sourceB], k, config);
      const atoms = out.getBlock("atoms");
      const x = atoms?.copyColF("x");
      const y = atoms?.copyColF("y");
      expect(x?.[0]).toBeCloseTo(k * 10, 9); // source A frame(k)
      expect(y?.[1]).toBeCloseTo(k * 100, 9); // source B frame(k)
    }
  });
});

// ── ac-005 unequal >1 lengths throw ───────────────────────────────────────────

describe("synthesize (ac-005 unequal lengths)", () => {
  it("ac-005 length-2 + length-3 sources → throws naming the id and both lengths", async () => {
    const sourceA = makeSource("a", [
      makeFrame([[0, 0, 0]], ["A"]),
      makeFrame([[1, 0, 0]], ["A"]),
    ]); // length 2
    const sourceB = makeSource("b", [
      makeFrame([[0, 0, 0]], ["B"]),
      makeFrame([[0, 1, 0]], ["B"]),
      makeFrame([[0, 2, 0]], ["B"]),
    ]); // length 3 (= maxLength)
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };

    await expect(synthesize([sourceA, sourceB], 0, config)).rejects.toThrow(
      /2[\s\S]*3|3[\s\S]*2/,
    );
    await expect(synthesize([sourceA, sourceB], 0, config)).rejects.toThrow(
      /\ba\b/,
    );
  });
});

// ── ac-006 single-source passthrough ──────────────────────────────────────────

describe("synthesize (ac-006 single-source passthrough)", () => {
  it("ac-006 one source → frame(frameIndex) coords unchanged, no source_id column", async () => {
    const coords: Array<[number, number, number]> = [
      [0.5, 1.5, 2.5],
      [3.5, 4.5, 5.5],
    ];
    const source = makeSource("solo", [
      makeFrame([[9, 9, 9]], ["X"]),
      makeFrame(coords, ["C", "O"]),
    ]);
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: null,
      alignment: null,
    };

    const out = await synthesize([source], 1, config);
    const atoms = out.getBlock("atoms");
    expect(atoms?.nrows()).toBe(2);
    const x = atoms?.copyColF("x");
    const y = atoms?.copyColF("y");
    const z = atoms?.copyColF("z");
    for (let i = 0; i < coords.length; i++) {
      expect(x?.[i]).toBeCloseTo(coords[i][0], 9);
      expect(y?.[i]).toBeCloseTo(coords[i][1], 9);
      expect(z?.[i]).toBeCloseTo(coords[i][2], 9);
    }
    // passthrough must NOT inject a source_id column
    expect(atoms?.dtype("source_id")).toBeUndefined();
  });
});

// ── ac-007 (scientific) Kabsch alignment ON ───────────────────────────────────

describe("synthesize (ac-007 alignment ON, scientific)", () => {
  it("ac-007 second source = reference rotated 90°z → aligned coords match reference, rmsd < 1e-6", async () => {
    const refCoords: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
      [1, 1, 1],
    ];
    const movedCoords = refCoords.map(rotZ90);
    const ref = makeSource("ref", [makeFrame(refCoords, ["C", "O", "N", "H"])]);
    const moving = makeSource("mov", [
      makeFrame(movedCoords, ["C", "O", "N", "H"]),
    ]);
    const alignment: SynthesisAlignment = {
      enabled: true,
      massWeight: false,
      subset: null,
    };
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: "ref",
      alignment,
    };

    const out = await synthesize([ref, moving], 0, config);
    const atoms = out.getBlock("atoms");
    const x = atoms?.copyColF("x");
    const y = atoms?.copyColF("y");
    const z = atoms?.copyColF("z");
    // moving region (rows 4..7) must coincide with the reference coords.
    for (let i = 0; i < refCoords.length; i++) {
      expect(x?.[refCoords.length + i]).toBeCloseTo(refCoords[i][0], 6);
      expect(y?.[refCoords.length + i]).toBeCloseTo(refCoords[i][1], 6);
      expect(z?.[refCoords.length + i]).toBeCloseTo(refCoords[i][2], 6);
    }
    // per-source rmsd exposed via numeric meta (molrs getMetaScalar).
    const rmsd = out.getMetaScalar("synthesis_rmsd:mov");
    expect(rmsd).toBeDefined();
    expect(rmsd ?? Number.POSITIVE_INFINITY).toBeLessThan(POS_TOL);
  });
});

// ── ac-008 (scientific) mass-weighted alignment ───────────────────────────────

describe("synthesize (ac-008 mass-weighted alignment, scientific)", () => {
  it("ac-008 massWeight forwards a mass column → aligned rmsd < 1e-6", async () => {
    const refCoords: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
      [1, 1, 1],
    ];
    const masses = [12, 16, 14, 1];
    const movedCoords = refCoords.map(rotZ90);
    const ref = makeSource("ref", [
      makeFrame(refCoords, ["C", "O", "N", "H"], { mass: masses }),
    ]);
    const moving = makeSource("mov", [
      makeFrame(movedCoords, ["C", "O", "N", "H"], { mass: masses }),
    ]);
    const alignment: SynthesisAlignment = {
      enabled: true,
      massWeight: true,
      subset: null,
    };
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: "ref",
      alignment,
    };

    const out = await synthesize([ref, moving], 0, config);
    const rmsd = out.getMetaScalar("synthesis_rmsd:mov");
    expect(rmsd).toBeDefined();
    expect(rmsd ?? Number.POSITIVE_INFINITY).toBeLessThan(POS_TOL);
  });
});

// ── ac-009 alignment mismatch (no subset, differing counts) throws ────────────

describe("synthesize (ac-009 alignment count mismatch)", () => {
  it("ac-009 alignment ON, no subset, ref 2 atoms vs moving 3 atoms → throws naming both counts", async () => {
    const ref = makeSource("ref", [
      makeFrame(
        [
          [0, 0, 0],
          [1, 0, 0],
        ],
        ["C", "O"],
      ),
    ]);
    const moving = makeSource("mov", [
      makeFrame(
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        ["C", "O", "N"],
      ),
    ]);
    const alignment: SynthesisAlignment = {
      enabled: true,
      massWeight: false,
      subset: null,
    };
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: "ref",
      alignment,
    };

    await expect(synthesize([ref, moving], 0, config)).rejects.toThrow(
      /2[\s\S]*3|3[\s\S]*2/,
    );
  });
});

// ── ac-010 purity (no input mutation) + type importability ────────────────────

describe("synthesize (ac-010 purity / immutability)", () => {
  it("ac-010 input source frame's x column is unchanged after extend+alignment synthesize", async () => {
    const refCoords: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3],
    ];
    const movedCoords = refCoords.map(rotZ90);
    const refFrame = makeFrame(refCoords, ["C", "O", "N"]);
    const movFrame = makeFrame(movedCoords, ["C", "O", "N"]);
    const ref: SynthesisSource = {
      id: "ref",
      trajectory: new Trajectory([refFrame]),
    };
    const moving: SynthesisSource = {
      id: "mov",
      trajectory: new Trajectory([movFrame]),
    };

    // snapshot the moving source's x column BEFORE synthesize
    const before = Array.from(movFrame.getBlock("atoms")?.copyColF("x") ?? []);

    const alignment: SynthesisAlignment = {
      enabled: true,
      massWeight: false,
      subset: null,
    };
    const config: SceneSynthesisConfig = {
      mode: "extend",
      referenceId: "ref",
      alignment,
    };

    await synthesize([ref, moving], 0, config);

    const after = Array.from(movFrame.getBlock("atoms")?.copyColF("x") ?? []);
    expect(after).toEqual(before);
  });

  it("ac-010 SynthesisSource / SceneSynthesisConfig / SynthesisAlignment are importable types", () => {
    const alignment: SynthesisAlignment = {
      enabled: false,
      massWeight: false,
      subset: null,
    };
    const config: SceneSynthesisConfig = {
      mode: "augment",
      referenceId: null,
      alignment,
    };
    const source: SynthesisSource = {
      id: "x",
      trajectory: new Trajectory([makeFrame([[0, 0, 0]], ["X"])]),
    };
    expect(config.mode).toBe("augment");
    expect(alignment.enabled).toBe(false);
    expect(source.id).toBe("x");
  });
});
