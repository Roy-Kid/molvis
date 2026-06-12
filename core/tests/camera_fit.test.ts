import { describe, expect, it } from "@rstest/core";
import {
  FIT_MIN_DISTANCE,
  FIT_PADDING,
  fitBoundsToView,
  fitBoxToView,
  viewBasis,
} from "../src/camera/fit";
import { computeObb } from "../src/camera/obb";
import type { Vec3 } from "../src/camera/pose";

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

function boxCorners(
  hx: number,
  hy: number,
  hz: number,
  c: Vec3 = [0, 0, 0],
): Float64Array {
  const pts: number[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        pts.push(c[0] + sx * hx, c[1] + sy * hy, c[2] + sz * hz);
  return new Float64Array(pts);
}

describe("fitBoxToView — per-axis, radius-aware, auto-view", () => {
  const FOV = 0.8;
  // Flat slab 10 × 4 × 0.5 → non-degenerate, world axes, minor = z.
  const slab = computeObb(boxCorners(10, 4, 0.5), null);

  it("auto-view per-axis fit tightens for wide viewports (ac-002)", () => {
    const tanV = Math.tan(FOV / 2);
    const wide = fitBoxToView(slab, FOV, 2, { viewDirection: "auto" });
    // Looking down z the screen sees 10 (x) wide; at aspect 2 it is
    // width-limited: 10 / (2 * tanV) * padding.
    expect(wide.radius).toBeCloseTo((10 / (2 * tanV)) * FIT_PADDING, 4);

    const square = fitBoxToView(slab, FOV, 1, { viewDirection: "auto" });
    expect(wide.radius).toBeLessThan(square.radius);
  });

  it("auto direction aligns the view with the minor axis (ac-007)", () => {
    const fit = fitBoxToView(slab, FOV, 1, { viewDirection: "auto" });
    const basis = viewBasis(fit.direction.alpha, fit.direction.beta);
    const minor = slab.axes[2];
    const align = Math.abs(
      basis.forward[0] * minor[0] +
        basis.forward[1] * minor[1] +
        basis.forward[2] * minor[2],
    );
    expect(align).toBeCloseTo(1, 6);
  });

  it("iso view keeps the stable iso angles (ac-008)", () => {
    const fit = fitBoxToView(slab, FOV, 1, { viewDirection: "iso" });
    expect(fit.direction.alpha).toBeCloseTo(Math.PI / 4, 9);
    expect(fit.direction.beta).toBeCloseTo(Math.PI / 3, 9);
  });

  it("never clips: every corner of a tilted box stays within the framed view (ac-005)", () => {
    // Box tilted 45° about z — exactly the case the legacy maxDim fit clips.
    const a = Math.SQRT1_2;
    const e1: Vec3 = [a, a, 0];
    const e2: Vec3 = [-a, a, 0];
    const e3: Vec3 = [0, 0, 1];
    const h = [12, 3, 3];
    const pts: number[] = [];
    for (const s1 of [-1, 1])
      for (const s2 of [-1, 1])
        for (const s3 of [-1, 1])
          pts.push(
            s1 * h[0] * e1[0] + s2 * h[1] * e2[0] + s3 * h[2] * e3[0],
            s1 * h[0] * e1[1] + s2 * h[1] * e2[1] + s3 * h[2] * e3[1],
            s1 * h[0] * e1[2] + s2 * h[1] * e2[2] + s3 * h[2] * e3[2],
          );
    const points = new Float64Array(pts);
    const obb = computeObb(points, null);
    const aspect = 1.5;
    const fit = fitBoxToView(obb, FOV, aspect, { viewDirection: "iso" });
    const basis = viewBasis(fit.direction.alpha, fit.direction.beta);
    const tanV = Math.tan(FOV / 2);
    const tanH = aspect * tanV;

    // The fit is an orthographic projected-extent fit (like fitBoundsToView):
    // it guarantees every corner's projection onto the screen axes fits the
    // frustum half-size at the framing distance (perspective slack is absorbed
    // by FIT_PADDING). The legacy maxDim fit cannot make this guarantee for a
    // tilted box because maxDim underestimates the projected silhouette.
    for (let i = 0; i < points.length / 3; i++) {
      const vx = points[i * 3] - fit.center.x;
      const vy = points[i * 3 + 1] - fit.center.y;
      const vz = points[i * 3 + 2] - fit.center.z;
      const pr =
        vx * basis.right[0] + vy * basis.right[1] + vz * basis.right[2];
      const pu = vx * basis.up[0] + vy * basis.up[1] + vz * basis.up[2];
      expect(Math.abs(pr)).toBeLessThanOrEqual(fit.radius * tanH + 1e-6);
      expect(Math.abs(pu)).toBeLessThanOrEqual(fit.radius * tanV + 1e-6);
    }
  });
});
