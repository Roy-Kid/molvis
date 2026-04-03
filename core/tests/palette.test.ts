import { describe, expect, it } from "@rstest/core";
import { getColorMap, hexToLinearRgb } from "../src/artist/palette";

describe("colorForKey", () => {
  it("should return values in [0,1] for all channels", () => {
    const cm = getColorMap("tol-bright");
    const [r, g, b] = cm.colorForKey("C");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("should be deterministic for same input on same colormap instance", () => {
    const cm = getColorMap("tol-bright");
    const a = cm.colorForKey("Oxygen");
    const b = cm.colorForKey("Oxygen");
    expect(a[0]).toBeCloseTo(b[0], 10);
    expect(a[1]).toBeCloseTo(b[1], 10);
    expect(a[2]).toBeCloseTo(b[2], 10);
  });

  it("should produce different colors for different keys on a qualitative colormap", () => {
    const cm = getColorMap("tol-bright");
    const a = cm.colorForKey("C");
    const b = cm.colorForKey("N");
    const c = cm.colorForKey("O");
    // At least two should differ
    const abSame = a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const bcSame = b[0] === c[0] && b[1] === c[1] && b[2] === c[2];
    expect(abSame && bcSame).toBe(false);
  });

  it("should work with single-character keys", () => {
    const cm = getColorMap("tol-bright");
    const [r, g, b] = cm.colorForKey("H");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("should work with empty string key", () => {
    const cm = getColorMap("tol-bright");
    const [r, g, b] = cm.colorForKey("");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });
});

describe("hexToLinearRgb", () => {
  it("should convert black correctly", () => {
    const [r, g, b] = hexToLinearRgb("#000000");
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it("should convert white correctly", () => {
    const [r, g, b] = hexToLinearRgb("#FFFFFF");
    expect(r).toBeCloseTo(1, 3);
    expect(g).toBeCloseTo(1, 3);
    expect(b).toBeCloseTo(1, 3);
  });

  it("should return values in [0, 1]", () => {
    const [r, g, b] = hexToLinearRgb("#8844CC");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("should apply sRGB-to-linear conversion (not just divide by 255)", () => {
    // sRGB mid-gray (128/255 ≈ 0.502) → linear ≈ 0.216
    const [r] = hexToLinearRgb("#808080");
    expect(r).toBeLessThan(0.3);
    expect(r).toBeGreaterThan(0.15);
  });

  it("should handle hex without # prefix", () => {
    const [r1, g1, b1] = hexToLinearRgb("#FF0000");
    const [r2, g2, b2] = hexToLinearRgb("FF0000");
    expect(r1).toBeCloseTo(r2, 5);
    expect(g1).toBeCloseTo(g2, 5);
    expect(b1).toBeCloseTo(b2, 5);
  });
});
