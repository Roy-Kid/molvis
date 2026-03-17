import { describe, expect, it } from "@rstest/core";
import { hslColorFromString, hexToLinearRgb } from "../src/artist/palette";

describe("hslColorFromString", () => {
  it("should return a hex color string", () => {
    const color = hslColorFromString("C");
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("should be deterministic", () => {
    const a = hslColorFromString("Oxygen");
    const b = hslColorFromString("Oxygen");
    expect(a).toBe(b);
  });

  it("should produce different colors for different labels", () => {
    const a = hslColorFromString("C");
    const b = hslColorFromString("N");
    const c = hslColorFromString("O");
    // At least two should differ
    expect(a === b && b === c).toBe(false);
  });

  it("should handle single-character strings", () => {
    const color = hslColorFromString("H");
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("should handle empty string", () => {
    const color = hslColorFromString("");
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
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
