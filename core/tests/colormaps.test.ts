import { describe, expect, it } from "@rstest/core";
import { getColorMap, listColorMaps } from "../src/artist/palette";

describe("sampleColormap", () => {
  for (const name of listColorMaps()) {
    describe(name, () => {
      it("should return values in [0,1] at t=0", () => {
        const [r, g, b] = getColorMap(name).sample(0);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      });

      it("should return values in [0,1] at t=1", () => {
        const [r, g, b] = getColorMap(name).sample(1);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      });

      it("should return values in [0,1] at t=0.5", () => {
        const [r, g, b] = getColorMap(name).sample(0.5);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      });
    });
  }

  it("should clamp t < 0 to t=0", () => {
    const atZero = getColorMap("viridis").sample(0);
    const atNeg = getColorMap("viridis").sample(-1);
    expect(atNeg[0]).toBeCloseTo(atZero[0], 5);
    expect(atNeg[1]).toBeCloseTo(atZero[1], 5);
    expect(atNeg[2]).toBeCloseTo(atZero[2], 5);
  });

  it("should clamp t > 1 to t=1", () => {
    const atOne = getColorMap("viridis").sample(1);
    const atOver = getColorMap("viridis").sample(2);
    expect(atOver[0]).toBeCloseTo(atOne[0], 5);
    expect(atOver[1]).toBeCloseTo(atOne[1], 5);
    expect(atOver[2]).toBeCloseTo(atOne[2], 5);
  });

  it("grayscale should return t for all channels", () => {
    const [r, g, b] = getColorMap("grayscale").sample(0.3);
    expect(r).toBeCloseTo(0.3, 5);
    expect(g).toBeCloseTo(0.3, 5);
    expect(b).toBeCloseTo(0.3, 5);
  });

  it("different colormaps should produce different colors at t=0.5", () => {
    const viridis = getColorMap("viridis").sample(0.5);
    const plasma = getColorMap("plasma").sample(0.5);
    // At least one channel should differ significantly
    const diff =
      Math.abs(viridis[0] - plasma[0]) +
      Math.abs(viridis[1] - plasma[1]) +
      Math.abs(viridis[2] - plasma[2]);
    expect(diff).toBeGreaterThan(0.01);
  });
});
