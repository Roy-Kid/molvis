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

  it("round-trips every arm through project params", () => {
    // Project save, backend state-sync, and RPC all rebuild modifiers from
    // the registry with default params — a surface saved as SES must not
    // come back as the default algorithm.
    const saved = new MolecularSurfaceModifier();
    saved.setAlgorithm("sas");
    saved.setSolventParams({
      resolution: 0.25,
      probeRadius: 1.8,
      radiusScale: 1.1,
    });
    saved.setGaussianParams({ sigma: 2.2, cutoff: 6 });
    saved.setAlphaParams({ probeRadius: 4.5, smoothing: 7 });
    saved.setStyle({ opacity: 0.35, color: [0.1, 0.2, 0.3] });

    const restored = new MolecularSurfaceModifier();
    restored.fromProjectParams(saved.toProjectParams());

    expect(restored.algorithm).toBe("sas");
    expect(restored.solventParams).toEqual(saved.solventParams);
    expect(restored.gaussianParams).toEqual(saved.gaussianParams);
    expect(restored.alphaParams).toEqual(saved.alphaParams);
    expect(restored.style.opacity).toBeCloseTo(0.35, 6);
    expect(restored.style.color).toEqual([0.1, 0.2, 0.3]);
  });

  it("ignores junk in a persisted record instead of adopting it", () => {
    // Project files come off disk and may be older or hand-edited.
    const mod = new MolecularSurfaceModifier();
    const defaults = mod.solventParams;
    mod.fromProjectParams({
      algorithm: "not-an-algorithm",
      solvent: "nonsense",
      gaussian: null,
      alpha: 42,
      opacity: "0.5",
      color: [1, 2],
    });

    expect(mod.algorithm).toBe("ses");
    expect(mod.solventParams).toEqual(defaults);
    expect(mod.style.color.length).toBe(3);
  });

  it("an unpinned isovalue stays automatic across a round trip", () => {
    const saved = new MolecularSurfaceModifier();
    const restored = new MolecularSurfaceModifier();
    restored.fromProjectParams(saved.toProjectParams());
    // Explicitly setting one is what pins it; nothing else should.
    expect(saved.toProjectParams().isovalue).toBeNull();

    saved.setStyle({ isovalue: 0.42 });
    restored.fromProjectParams(saved.toProjectParams());
    expect(restored.style.isovalue).toBeCloseTo(0.42, 6);
  });

  it("style patches keep the density channel", () => {
    const mod = new MolecularSurfaceModifier();
    mod.setStyle({ opacity: 0.3 });
    expect(mod.style.opacity).toBe(0.3);
    expect(mod.style.channel).toBe("density");
  });
});
