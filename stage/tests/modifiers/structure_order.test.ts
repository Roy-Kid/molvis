import { Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { COLOR_OVERRIDE_R } from "../../src/modifiers/ColorByPropertyModifier";
import { SolidLiquidModifier } from "../../src/modifiers/SolidLiquidModifier";
import { SteinhardtOrderModifier } from "../../src/modifiers/SteinhardtOrderModifier";
import {
  SOLID_LIQUID_COLUMN,
  SOLID_LIQUID_N_BONDS_COLUMN,
  steinhardtQColumn,
} from "../../src/modifiers/structure_order_shared";
import type { PipelineContext } from "../../src/pipeline/types";
import { createDefaultContext } from "../../src/pipeline/types";

/** Simple cubic lattice with enough neighbors for Steinhardt at cutoff ~1.5. */
function scLattice(n = 3, spacing = 1.0): Frame {
  const frame = new Frame();
  const atoms = frame.createBlock("atoms");
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        xs.push(i * spacing);
        ys.push(j * spacing);
        zs.push(k * spacing);
      }
    }
  }
  atoms.setColF("x", Float64Array.from(xs));
  atoms.setColF("y", Float64Array.from(ys));
  atoms.setColF("z", Float64Array.from(zs));
  const L = (n - 1) * spacing + 2;
  frame.box = Box.cube(L, new Float64Array([0, 0, 0]), true, true, true);
  return frame;
}

function dummyCtx(frame: Frame): PipelineContext {
  return createDefaultContext(frame, {} as never);
}

describe("SteinhardtOrderModifier", () => {
  it("writes steinhardt_q6 and color overrides when colorScene is on", () => {
    const frame = scLattice();
    const mod = new SteinhardtOrderModifier();
    mod.setLValues([6]);
    mod.setCutoff(1.5);
    mod.setColorScene(true);
    mod.setColorL(6);

    const out = mod.apply(frame, dummyCtx(frame));
    const atoms = out.getBlock("atoms");
    expect(atoms).toBeTruthy();
    expect(atoms?.dtype(steinhardtQColumn(6))).toBe("f64");
    const ql = atoms?.viewColF(steinhardtQColumn(6));
    expect(ql?.length).toBe(27);
    // Colors injected for scene path
    expect(atoms?.dtype(COLOR_OVERRIDE_R)).toBe("f64");

    if (out !== frame) out.free();
    frame.free();
  });

  it("writes columns without colors when colorScene is off", () => {
    const frame = scLattice();
    const mod = new SteinhardtOrderModifier();
    mod.setColorScene(false);
    const out = mod.apply(frame, dummyCtx(frame));
    const atoms = out.getBlock("atoms");
    expect(atoms?.dtype(steinhardtQColumn(6))).toBe("f64");
    expect(atoms?.dtype(COLOR_OVERRIDE_R)).toBeUndefined();
    if (out !== frame) out.free();
    frame.free();
  });
});

describe("SolidLiquidModifier", () => {
  it("writes solid_liquid and n_bonds columns", () => {
    const frame = scLattice();
    const mod = new SolidLiquidModifier();
    mod.setCutoff(1.5);
    mod.setColorScene(true);

    const out = mod.apply(frame, dummyCtx(frame));
    const atoms = out.getBlock("atoms");
    expect(atoms?.dtype(SOLID_LIQUID_COLUMN)).toBe("f64");
    expect(atoms?.dtype(SOLID_LIQUID_N_BONDS_COLUMN)).toBe("f64");
    const solid = atoms?.viewColF(SOLID_LIQUID_COLUMN);
    expect(solid?.length).toBe(27);
    // Values are 0 or 1
    for (let i = 0; i < (solid?.length ?? 0); i++) {
      expect(solid![i] === 0 || solid![i] === 1).toBe(true);
    }
    expect(atoms?.dtype(COLOR_OVERRIDE_R)).toBe("f64");

    if (out !== frame) out.free();
    frame.free();
  });
});
