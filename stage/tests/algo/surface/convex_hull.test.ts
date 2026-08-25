/**
 * ConvexHull tests.
 *
 * Assertions are on the hull's geometric contract — closure, containment,
 * outward normals — rather than on an exact triangulation, since quickhull
 * is free to split a coplanar face any way it likes.
 */

import { describe, expect, test } from "@rstest/core";
import {
  ConvexHull,
  type HullPoints,
} from "../../../src/algo/surface/convex_hull";

function pointsOf(
  coords: ReadonlyArray<readonly [number, number, number]>,
): HullPoints {
  return {
    x: coords.map((c) => c[0]),
    y: coords.map((c) => c[1]),
    z: coords.map((c) => c[2]),
    count: coords.length,
  };
}

const CUBE = pointsOf([
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]);

/** Every triangle's plane must have all points on or behind it. */
function allPointsBehindEveryFace(
  points: HullPoints,
  hull: ConvexHull,
): boolean {
  const { positions, normals, indices } = hull.mesh;
  for (let t = 0; t < indices.length; t += 3) {
    const at = indices[t] * 3;
    const nx = normals[at];
    const ny = normals[at + 1];
    const nz = normals[at + 2];
    const offset =
      nx * positions[at] + ny * positions[at + 1] + nz * positions[at + 2];
    for (let i = 0; i < points.count; i++) {
      const d = nx * points.x[i] + ny * points.y[i] + nz * points.z[i] - offset;
      if (d > 1e-6) return false;
    }
  }
  return true;
}

/** Divergence theorem over the triangle fan: V = Σ (a · (b × c)) / 6. */
function volumeOf(hull: ConvexHull): number {
  const { positions, indices } = hull.mesh;
  let total = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    total +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return total / 6;
}

describe("ConvexHull", () => {
  test("a cube's eight corners give a closed 12-triangle hull", () => {
    const hull = new ConvexHull(CUBE);
    expect(hull.degenerate).toBe(false);
    // Each square face splits into two triangles.
    expect(hull.mesh.indices.length / 3).toBe(12);
  });

  test("every face plane bounds the whole point set", () => {
    expect(allPointsBehindEveryFace(CUBE, new ConvexHull(CUBE))).toBe(true);
  });

  test("normals point outward, so the signed volume is positive", () => {
    // A negative volume would mean inverted winding — the surface would light
    // from the inside.
    expect(volumeOf(new ConvexHull(CUBE))).toBeCloseTo(1, 6);
  });

  test("interior points do not change the hull", () => {
    const withCentre = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0.5, 0.5, 0.5],
      [0.25, 0.3, 0.7],
    ]);
    expect(volumeOf(new ConvexHull(withCentre))).toBeCloseTo(1, 6);
  });

  test("a tetrahedron is its own hull", () => {
    const tetra = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    const hull = new ConvexHull(tetra);
    expect(hull.mesh.indices.length / 3).toBe(4);
    expect(volumeOf(hull)).toBeCloseTo(1 / 6, 6);
  });

  test("an FCC lattice hulls without tripping on its degeneracies", () => {
    // Perfect crystals are the adversarial case: masses of cospherical and
    // coplanar points. Random clouds never exercise this.
    const coords: Array<[number, number, number]> = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) {
          coords.push([i, j, k]);
          if (i < 2 && j < 2) coords.push([i + 0.5, j + 0.5, k]);
        }
    const points = pointsOf(coords);
    const hull = new ConvexHull(points);
    expect(hull.degenerate).toBe(false);
    expect(allPointsBehindEveryFace(points, hull)).toBe(true);
    expect(volumeOf(hull)).toBeCloseTo(8, 6);
  });

  test("scale does not matter — a large cube hulls like a small one", () => {
    const big = pointsOf(
      CUBE.x.length
        ? Array.from(
            { length: CUBE.count },
            (_, i) =>
              [CUBE.x[i] * 1000, CUBE.y[i] * 1000, CUBE.z[i] * 1000] as [
                number,
                number,
                number,
              ],
          )
        : [],
    );
    const hull = new ConvexHull(big);
    expect(hull.degenerate).toBe(false);
    expect(volumeOf(hull)).toBeCloseTo(1e9, 0);
  });

  test("fewer than four points cannot bound a volume", () => {
    expect(
      new ConvexHull(
        pointsOf([
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]),
      ).degenerate,
    ).toBe(true);
  });

  test("collinear points are reported degenerate, not crashed on", () => {
    const line = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ]);
    const hull = new ConvexHull(line);
    expect(hull.degenerate).toBe(true);
    expect(hull.mesh.indices.length).toBe(0);
  });

  test("coplanar points are reported degenerate, not crashed on", () => {
    const plane = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0.5, 0.5, 0],
    ]);
    const hull = new ConvexHull(plane);
    expect(hull.degenerate).toBe(true);
    expect(hull.mesh.indices.length).toBe(0);
  });
});
