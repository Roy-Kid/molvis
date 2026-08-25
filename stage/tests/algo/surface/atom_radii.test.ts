/**
 * AtomRadii tests — element lookup, scaling, and the no-element fallback.
 */

import { describe, expect, test } from "@rstest/core";
import {
  AtomRadii,
  FALLBACK_RADIUS,
} from "../../../src/algo/surface/atom_radii";

describe("AtomRadii", () => {
  test("reads tabulated van der Waals radii per element", () => {
    const r = new AtomRadii(3, ["C", "N", "O"], { scale: 1 });
    expect(r.values[0]).toBeCloseTo(1.91, 6);
    expect(r.values[1]).toBeCloseTo(1.798, 6);
    expect(r.values[2]).toBeCloseTo(1.715, 6);
    expect(r.usedFallback).toBe(false);
  });

  test("max reports the largest radius, which sets the grid padding", () => {
    const r = new AtomRadii(3, ["H", "C", "N"], { scale: 1 });
    expect(r.max).toBeCloseTo(1.91, 6);
  });

  test("scale multiplies every radius", () => {
    const r = new AtomRadii(2, ["C", "O"], { scale: 0.5 });
    expect(r.values[0]).toBeCloseTo(1.91 * 0.5, 6);
    expect(r.values[1]).toBeCloseTo(1.715 * 0.5, 6);
    expect(r.max).toBeCloseTo(1.91 * 0.5, 6);
  });

  test("element casing is normalised", () => {
    const upper = new AtomRadii(1, ["CL"], { scale: 1 });
    const mixed = new AtomRadii(1, ["Cl"], { scale: 1 });
    expect(upper.values[0]).toBeCloseTo(mixed.values[0], 12);
  });

  test("no element column falls back to a uniform radius and says so", () => {
    const r = new AtomRadii(2, undefined, { scale: 1 });
    expect(r.values[0]).toBeCloseTo(FALLBACK_RADIUS, 12);
    expect(r.values[1]).toBeCloseTo(FALLBACK_RADIUS, 12);
    expect(r.usedFallback).toBe(true);
  });

  test("a short element column is treated as missing, not read out of bounds", () => {
    const r = new AtomRadii(3, ["C"], { scale: 1 });
    expect(r.usedFallback).toBe(true);
    expect(r.values.length).toBe(3);
    for (const v of r.values) expect(v).toBeCloseTo(FALLBACK_RADIUS, 12);
  });

  test("a non-positive scale is clamped rather than producing zero radii", () => {
    const r = new AtomRadii(1, ["C"], { scale: 0 });
    expect(r.values[0]).toBeGreaterThan(0);
  });
});
