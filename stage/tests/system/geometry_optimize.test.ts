import {
  type Frame,
  generate3D,
  parseSMILES,
} from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import {
  isWasmForceField,
  runGeometryOptimize,
  runWasmGeometryOptimize,
} from "../../src/system/geometry_optimize";

function ethanol3d(): Frame {
  const ir = parseSMILES("CCO");
  const f2 = ir.toFrame();
  ir.free?.();
  const f3 = generate3D(f2, "fast", 1);
  f2.free();
  return f3;
}

function bondStretch(
  frame: Frame,
  atomI: number,
  atomJ: number,
  scale: number,
): void {
  const atoms = frame.getBlock("atoms");
  if (!atoms) throw new Error("no atoms");
  const x = atoms.copyColF("x")!;
  const y = atoms.copyColF("y")!;
  const z = atoms.copyColF("z")!;
  // Pull atomJ away from atomI along the bond vector.
  const dx = x[atomJ] - x[atomI];
  const dy = y[atomJ] - y[atomI];
  const dz = z[atomJ] - z[atomI];
  x[atomJ] = x[atomI] + dx * scale;
  y[atomJ] = y[atomI] + dy * scale;
  z[atomJ] = z[atomI] + dz * scale;
  atoms.setColF("x", x);
  atoms.setColF("y", y);
  atoms.setColF("z", z);
}

describe("geometry_optimize WASM MMFF", () => {
  it("isWasmForceField classifies methods", () => {
    expect(isWasmForceField("uff")).toBe(true);
    expect(isWasmForceField("mmff94")).toBe(true);
    expect(isWasmForceField("mmff94s")).toBe(true);
    expect(isWasmForceField("soft")).toBe(false);
    expect(isWasmForceField("gfnff")).toBe(false);
  });

  it("runWasmGeometryOptimize UFF lowers force on distorted ethanol", async () => {
    const frame = ethanol3d();
    try {
      bondStretch(frame, 0, 1, 1.35);
      const report = await runWasmGeometryOptimize({
        frame,
        method: "uff",
        maxSteps: 80,
        forceTol: 0.1,
        reportEvery: 20,
      });
      expect(report.steps).toBeGreaterThan(0);
      expect(Number.isFinite(report.energy)).toBe(true);
      expect(report.cancelled).toBe(false);
      expect(report.maxForce).toBeLessThan(50);
    } finally {
      frame.free();
    }
  });

  it("runWasmGeometryOptimize MMFF94 lowers force on distorted ethanol", async () => {
    const frame = ethanol3d();
    try {
      bondStretch(frame, 0, 1, 1.35);
      const report = await runWasmGeometryOptimize({
        frame,
        method: "mmff94",
        maxSteps: 80,
        forceTol: 0.1,
        reportEvery: 20,
      });
      expect(report.steps).toBeGreaterThan(0);
      expect(Number.isFinite(report.energy)).toBe(true);
      expect(report.cancelled).toBe(false);
      expect(report.maxForce).toBeLessThan(50);
    } finally {
      frame.free();
    }
  });

  it("runGeometryOptimize rejects wasm methods", async () => {
    await expect(
      runGeometryOptimize({
        coords: new Float64Array([0, 0, 0, 1, 0, 0]),
        elements: ["C", "C"],
        bonds: [[0, 1]],
        method: "mmff94",
        maxSteps: 1,
      }),
    ).rejects.toThrow(/requires molrs WASM/);
  });

  it("soft spring path still runs", async () => {
    const coords = new Float64Array([0, 0, 0, 2.5, 0, 0]);
    const r = await runGeometryOptimize({
      coords,
      elements: ["C", "C"],
      bonds: [[0, 1]],
      method: "soft",
      maxSteps: 30,
      forceTol: 0.2,
    });
    expect(r.steps).toBeGreaterThan(0);
    // Bond should shorten toward ~1.5 Å (2× covalent C radius).
    const dx = coords[3] - coords[0];
    expect(Math.abs(dx)).toBeLessThan(2.5);
  });
});
