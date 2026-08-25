/**
 * AlphaShape tests.
 *
 * The two claims worth pinning are the limiting behaviours — large α is the
 * convex hull, small α crumbles — plus outward winding in a concave pocket,
 * which is where a centroid-based orientation would quietly fail.
 */

import { describe, expect, test } from "@rstest/core";
import { AlphaShape } from "../../../src/algo/surface/alpha_shape";
import type { DelaunayPoints } from "../../../src/algo/surface/delaunay_3d";

function pointsOf(
  coords: ReadonlyArray<readonly [number, number, number]>,
): DelaunayPoints {
  return {
    x: coords.map((c) => c[0]),
    y: coords.map((c) => c[1]),
    z: coords.map((c) => c[2]),
    count: coords.length,
  };
}

/** Signed volume of the closed surface; negative means inverted winding. */
function signedVolume(mesh: {
  positions: Float32Array;
  indices: Uint32Array;
}): number {
  let total = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t] * 3;
    const b = mesh.indices[t + 1] * 3;
    const c = mesh.indices[t + 2] * 3;
    const ax = mesh.positions[a];
    const ay = mesh.positions[a + 1];
    const az = mesh.positions[a + 2];
    const bx = mesh.positions[b];
    const by = mesh.positions[b + 1];
    const bz = mesh.positions[b + 2];
    const cx = mesh.positions[c];
    const cy = mesh.positions[c + 1];
    const cz = mesh.positions[c + 2];
    total +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return total / 6;
}

/** A filled cubic block of lattice points, spacing 1. */
function block(nx: number, ny: number, nz: number): DelaunayPoints {
  const coords: Array<[number, number, number]> = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) coords.push([i, j, k]);
  return pointsOf(coords);
}

describe("AlphaShape", () => {
  test("a large probe reproduces the convex hull volume", () => {
    // With α above every circumradius, no tetrahedron is filtered out, so the
    // boundary is the hull of the point set.
    const points = block(4, 4, 4);
    const shape = new AlphaShape(points, { probeRadius: 50, smoothing: 0 });
    expect(shape.degenerate).toBe(false);
    expect(signedVolume(shape.mesh)).toBeCloseTo(27, 6);
  });

  test("normals point outward, so the enclosed volume is positive", () => {
    const shape = new AlphaShape(block(4, 4, 4), {
      probeRadius: 50,
      smoothing: 0,
    });
    expect(signedVolume(shape.mesh)).toBeGreaterThan(0);
  });

  test("a probe below the lattice spacing dissolves the solid", () => {
    const shape = new AlphaShape(block(4, 4, 4), {
      probeRadius: 0.2,
      smoothing: 0,
    });
    expect(shape.solidCount).toBe(0);
    expect(shape.degenerate).toBe(true);
    expect(shape.mesh.indices.length).toBe(0);
  });

  test("shrinking the probe never grows the solid", () => {
    const points = block(4, 4, 4);
    let previous = Number.POSITIVE_INFINITY;
    for (const probeRadius of [50, 2, 1.2, 0.9]) {
      const shape = new AlphaShape(points, { probeRadius, smoothing: 0 });
      expect(shape.solidCount).toBeLessThanOrEqual(previous);
      previous = shape.solidCount;
    }
  });

  test("a concave pocket keeps its winding outward", () => {
    // An L-shaped block: a centroid-based orientation test would misjudge the
    // faces tucked into the notch, lighting them from the inside.
    const coords: Array<[number, number, number]> = [];
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        for (let k = 0; k < 3; k++) {
          if (i >= 2 && j >= 2) continue;
          coords.push([i, j, k]);
        }
    const shape = new AlphaShape(pointsOf(coords), {
      probeRadius: 1.2,
      smoothing: 0,
    });
    expect(shape.degenerate).toBe(false);
    // The L is genuinely non-convex, so this is not the hull's volume.
    expect(signedVolume(shape.mesh)).toBeGreaterThan(0);
    expect(signedVolume(shape.mesh)).toBeLessThan(4 * 4 * 2);
  });

  test("smoothing does not shrink the surface away", () => {
    // Plain Laplacian smoothing loses volume every pass; Taubin's paired
    // shrink/unshrink is what keeps the reported molecule the right size.
    const points = block(5, 5, 5);
    const raw = signedVolume(
      new AlphaShape(points, { probeRadius: 50, smoothing: 0 }).mesh,
    );
    const smoothed = signedVolume(
      new AlphaShape(points, { probeRadius: 50, smoothing: 6 }).mesh,
    );
    expect(smoothed).toBeGreaterThan(raw * 0.9);
  });

  test("smoothing moves vertices but keeps the triangle count", () => {
    const points = block(4, 4, 4);
    const raw = new AlphaShape(points, { probeRadius: 50, smoothing: 0 });
    const smoothed = new AlphaShape(points, { probeRadius: 50, smoothing: 3 });
    expect(smoothed.triangleCount).toBe(raw.triangleCount);
    expect(Array.from(smoothed.mesh.positions)).not.toEqual(
      Array.from(raw.mesh.positions),
    );
  });

  test("a planar point set is degenerate, not a crash", () => {
    const flat = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [2, 0, 0],
    ]);
    const shape = new AlphaShape(flat, { probeRadius: 5, smoothing: 0 });
    expect(shape.degenerate).toBe(true);
  });
});
