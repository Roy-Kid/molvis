import { Box, Frame } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { GaussianDensitySurfaceModifier } from "../../src/pipeline/gaussian_density_surface";

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

describe("GaussianDensitySurfaceModifier", () => {
  it("matches frames with atoms and a box", () => {
    const mod = new GaussianDensitySurfaceModifier();
    const frame = atomsInBox();
    expect(mod.matches(frame)).toBe(true);
    expect(mod.isApplicable(frame)).toBe(true);
    frame.free();
  });

  it("does not match atomsless frames", () => {
    const mod = new GaussianDensitySurfaceModifier();
    const frame = new Frame();
    expect(mod.matches(frame)).toBe(false);
    frame.free();
  });

  it("updates grid and sigma params in cache key", () => {
    const mod = new GaussianDensitySurfaceModifier();
    const a = mod.getCacheKey();
    mod.setGrid(16, 16, 16);
    mod.setSigma(2);
    const b = mod.getCacheKey();
    expect(b).not.toBe(a);
  });
});
