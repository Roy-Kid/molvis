/**
 * EuclideanDistanceTransform tests.
 *
 * The separable Felzenszwalb–Huttenlocher pass is exact, so it is checked
 * against a brute-force nearest-seed search rather than a tolerance band.
 */

import { describe, expect, test } from "@rstest/core";
import { EuclideanDistanceTransform } from "../../../src/algo/surface/distance_transform";

type Shape = [number, number, number];

/** O(n²) reference: distance from every voxel to the nearest seed. */
function bruteForce(
  shape: Shape,
  spacing: number,
  seeds: Uint8Array,
): Float64Array {
  const [nx, ny, nz] = shape;
  const out = new Float64Array(nx * ny * nz);
  const seedList: Array<[number, number, number]> = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++)
        if (seeds[(i * ny + j) * nz + k] !== 0) seedList.push([i, j, k]);

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        let best = Number.POSITIVE_INFINITY;
        for (const [si, sj, sk] of seedList) {
          const d = (i - si) ** 2 + (j - sj) ** 2 + (k - sk) ** 2;
          if (d < best) best = d;
        }
        out[(i * ny + j) * nz + k] = Math.sqrt(best) * spacing;
      }
    }
  }
  return out;
}

describe("EuclideanDistanceTransform", () => {
  test("single seed gives the exact radial distance", () => {
    const shape: Shape = [5, 5, 5];
    const seeds = new Uint8Array(125);
    seeds[(2 * 5 + 2) * 5 + 2] = 1;
    const { distances } = new EuclideanDistanceTransform(shape, 1, seeds);

    expect(distances[(2 * 5 + 2) * 5 + 2]).toBeCloseTo(0, 12);
    expect(distances[(0 * 5 + 2) * 5 + 2]).toBeCloseTo(2, 12);
    expect(distances[(0 * 5 + 0) * 5 + 2]).toBeCloseTo(Math.sqrt(8), 12);
    expect(distances[0]).toBeCloseTo(Math.sqrt(12), 12);
  });

  test("spacing scales the result linearly", () => {
    const shape: Shape = [4, 4, 4];
    const seeds = new Uint8Array(64);
    seeds[0] = 1;
    const unit = new EuclideanDistanceTransform(shape, 1, seeds).distances;
    const half = new EuclideanDistanceTransform(shape, 0.5, seeds).distances;
    for (let i = 0; i < unit.length; i++) {
      expect(half[i]).toBeCloseTo(unit[i] * 0.5, 12);
    }
  });

  test("every voxel a seed gives all zeros", () => {
    const shape: Shape = [4, 3, 5];
    const seeds = new Uint8Array(60).fill(1);
    const { distances } = new EuclideanDistanceTransform(shape, 0.7, seeds);
    for (const d of distances) expect(d).toBeCloseTo(0, 12);
  });

  test("matches brute force on a non-cubic grid with scattered seeds", () => {
    const shape: Shape = [7, 5, 6];
    const seeds = new Uint8Array(7 * 5 * 6);
    // Deterministic scatter — no Math.random, so failures reproduce.
    for (const [i, j, k] of [
      [0, 0, 0],
      [6, 4, 5],
      [3, 2, 1],
      [1, 4, 4],
    ] as const) {
      seeds[(i * 5 + j) * 6 + k] = 1;
    }
    const spacing = 0.31;
    const fast = new EuclideanDistanceTransform(shape, spacing, seeds)
      .distances;
    const slow = bruteForce(shape, spacing, seeds);
    for (let i = 0; i < slow.length; i++) {
      expect(fast[i]).toBeCloseTo(slow[i], 10);
    }
  });

  test("a seeded plane gives distance to that plane", () => {
    const shape: Shape = [6, 4, 4];
    const seeds = new Uint8Array(96);
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++) seeds[(0 * 4 + j) * 4 + k] = 1;
    const { distances } = new EuclideanDistanceTransform(shape, 1, seeds);
    for (let i = 0; i < 6; i++) {
      expect(distances[(i * 4 + 2) * 4 + 2]).toBeCloseTo(i, 12);
    }
  });
});
