import { describe, expect, it } from "@rstest/core";
import {
  FIT_MIN_DISTANCE,
  FIT_PADDING,
  fitBoundsToView,
} from "../src/camera/fit";

/**
 * Characterization tests for the shared scene-fit helper. The math was
 * extracted verbatim from `World.resetCamera`; these tests reproduce the
 * ORIGINAL inline formula and assert the helper still returns the same
 * center/radius, so the refactor cannot silently change framing.
 */

// The pre-refactor formula, transcribed from world.ts:158-191.
function legacyFit(
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  },
  fov: number,
  aspectRatio: number,
): { cx: number; cy: number; cz: number; radius: number } {
  const cx = (bounds.min.x + bounds.max.x) * 0.5;
  const cy = (bounds.min.y + bounds.max.y) * 0.5;
  const cz = (bounds.min.z + bounds.max.z) * 0.5;
  const sx = bounds.max.x - bounds.min.x;
  const sy = bounds.max.y - bounds.min.y;
  const sz = bounds.max.z - bounds.min.z;
  const maxDim = Math.max(sx, sy, sz);
  let distance = maxDim / (2 * Math.tan(fov / 2));
  if (aspectRatio < 1.0) distance = distance / aspectRatio;
  distance *= 1.2;
  distance = Math.max(distance, 5.0);
  return { cx, cy, cz, radius: distance };
}

describe("fitBoundsToView — characterization vs legacy resetCamera (ac-005)", () => {
  const fov = 0.8;

  it("matches legacy center/radius for a wide-aspect, large box", () => {
    const bounds = {
      min: { x: -10, y: -4, z: -6 },
      max: { x: 30, y: 12, z: 18 },
    };
    const aspect = 1.6;
    const got = fitBoundsToView(bounds, fov, aspect);
    const want = legacyFit(bounds, fov, aspect);
    expect(got.center.x).toBeCloseTo(want.cx, 6);
    expect(got.center.y).toBeCloseTo(want.cy, 6);
    expect(got.center.z).toBeCloseTo(want.cz, 6);
    expect(got.radius).toBeCloseTo(want.radius, 6);
  });

  it("applies the aspect<1 widening branch identically", () => {
    const bounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 40, y: 40, z: 40 },
    };
    const aspect = 0.5;
    const got = fitBoundsToView(bounds, fov, aspect);
    const want = legacyFit(bounds, fov, aspect);
    expect(got.radius).toBeCloseTo(want.radius, 6);
    // sanity: the <1 branch must have widened the distance
    expect(got.radius).toBeGreaterThan(
      (40 / (2 * Math.tan(fov / 2))) * FIT_PADDING,
    );
  });

  it("clamps to the minimum distance for a tiny box", () => {
    const bounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0.01, y: 0.01, z: 0.01 },
    };
    const got = fitBoundsToView(bounds, fov, 1.0);
    expect(got.radius).toBeCloseTo(FIT_MIN_DISTANCE, 6);
  });

  it("handles degenerate (single-point) bounds without NaN", () => {
    const bounds = {
      min: { x: 5, y: 5, z: 5 },
      max: { x: 5, y: 5, z: 5 },
    };
    const got = fitBoundsToView(bounds, fov, 1.0);
    expect(Number.isNaN(got.radius)).toBe(false);
    expect(got.radius).toBeCloseTo(FIT_MIN_DISTANCE, 6);
    expect(got.center.x).toBeCloseTo(5, 6);
  });
});
