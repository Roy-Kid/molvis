/**
 * MolecularSurfaceModifier tests.
 *
 * Field math lives in `tests/algo/surface/`; this file covers the modifier
 * contract — gating, the algorithm discriminant, per-algorithm parameter
 * isolation, and the cache key.
 *
 * Absorbs the gating and cache-key coverage of the deleted
 * `gaussian_density_surface.test.ts`.
 */

import { Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import {
  isMeshAlgorithm,
  MolecularSurfaceModifier,
} from "../../src/modifiers/MolecularSurfaceModifier";

function atomsInBox(): Frame {
  const frame = new Frame();
  const atoms = frame.createBlock("atoms");
  atoms.setColF("x", new Float64Array([1, 2, 3]));
  atoms.setColF("y", new Float64Array([1, 2, 3]));
  atoms.setColF("z", new Float64Array([1, 2, 3]));
  atoms.setColStr("element", ["C", "C", "O"]);
  frame.box = Box.cube(10, new Float64Array([0, 0, 0]), true, true, true);
  return frame;
}

describe("MolecularSurfaceModifier", () => {
  it("never auto-attaches — a surface is opt-in Visualization", () => {
    const mod = new MolecularSurfaceModifier();
    const frame = atomsInBox();
    expect(mod.matches(frame)).toBe(false);
    expect(mod.isApplicable(frame)).toBe(true);
    frame.free();
  });

  it("is not applicable without atoms", () => {
    const mod = new MolecularSurfaceModifier();
    const frame = new Frame();
    expect(mod.isApplicable(frame)).toBe(false);
    frame.free();
  });

  it("is applicable with atoms only — the box is not required", () => {
    const mod = new MolecularSurfaceModifier();
    const frame = new Frame();
    const atoms = frame.createBlock("atoms");
    atoms.setColF("x", new Float64Array([1]));
    atoms.setColF("y", new Float64Array([2]));
    atoms.setColF("z", new Float64Array([3]));
    expect(mod.isApplicable(frame)).toBe(true);
    expect(mod.matches(frame)).toBe(false);
    frame.free();
  });

  it("defaults to the solvent-excluded surface", () => {
    expect(new MolecularSurfaceModifier().algorithm).toBe("ses");
  });

  it("switching algorithm keeps every algorithm's own parameters", () => {
    const mod = new MolecularSurfaceModifier();
    mod.setSolventParams({ probeRadius: 1.8 });
    mod.setAlgorithm("gaussian");
    mod.setGaussianParams({ sigma: 2.5 });
    mod.setAlgorithm("sas");

    expect(mod.solventParams.probeRadius).toBe(1.8);
    expect(mod.gaussianParams.sigma).toBe(2.5);
  });

  it("parameter setters patch rather than replace the record", () => {
    const mod = new MolecularSurfaceModifier();
    const before = mod.solventParams.radiusScale;
    mod.setSolventParams({ probeRadius: 2 });
    expect(mod.solventParams.radiusScale).toBe(before);
  });

  it("cache key changes with the algorithm", () => {
    const mod = new MolecularSurfaceModifier();
    const ses = mod.getCacheKey();
    mod.setAlgorithm("vdw");
    expect(mod.getCacheKey()).not.toBe(ses);
  });

  it("cache key tracks the active algorithm's parameters", () => {
    const mod = new MolecularSurfaceModifier();
    mod.setAlgorithm("gaussian");
    const before = mod.getCacheKey();
    mod.setGaussianParams({ sigma: 2 });
    expect(mod.getCacheKey()).not.toBe(before);
  });

  it("cache key ignores parameters of inactive algorithms", () => {
    // Otherwise editing a hidden arm would force a pointless recompute.
    const mod = new MolecularSurfaceModifier();
    mod.setAlgorithm("vdw");
    const before = mod.getCacheKey();
    mod.setGaussianParams({ sigma: 3.7 });
    expect(mod.getCacheKey()).toBe(before);
  });

  it("classifies which algorithms bypass the grid entirely", () => {
    for (const mesh of ["hull", "alpha"] as const) {
      expect(isMeshAlgorithm(mesh)).toBe(true);
    }
    for (const field of ["vdw", "sas", "ses", "gaussian"] as const) {
      expect(isMeshAlgorithm(field)).toBe(false);
    }
  });

  it("alpha shape keeps its own probe radius, separate from SAS/SES", () => {
    // Both are called "probe radius" but they mean different things: one
    // rolls a solvent ball over spheres, the other filters circumradii.
    const mod = new MolecularSurfaceModifier();
    mod.setSolventParams({ probeRadius: 1.4 });
    mod.setAlgorithm("alpha");
    mod.setAlphaParams({ probeRadius: 4 });

    expect(mod.alphaParams.probeRadius).toBe(4);
    expect(mod.solventParams.probeRadius).toBe(1.4);
  });

  it("cache key tracks alpha parameters when alpha is active", () => {
    const mod = new MolecularSurfaceModifier();
    mod.setAlgorithm("alpha");
    const before = mod.getCacheKey();
    mod.setAlphaParams({ smoothing: 5 });
    expect(mod.getCacheKey()).not.toBe(before);
  });

  it("convex hull shares the solvent radius scale", () => {
    // Both read van der Waals radii, so a scale set in one arm should still
    // be in force after switching to the other.
    const mod = new MolecularSurfaceModifier();
    mod.setSolventParams({ radiusScale: 1.3 });
    mod.setAlgorithm("hull");
    expect(mod.solventParams.radiusScale).toBe(1.3);
  });

  it("style patches keep the density channel", () => {
    const mod = new MolecularSurfaceModifier();
    mod.setStyle({ opacity: 0.3 });
    expect(mod.style.opacity).toBe(0.3);
    expect(mod.style.channel).toBe("density");
  });
});
