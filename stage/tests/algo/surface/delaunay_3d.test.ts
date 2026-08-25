/**
 * Delaunay3D tests.
 *
 * Two properties do most of the work here, because a Delaunay
 * tetrahedralisation is not unique when points are cospherical:
 *
 * - **Empty circumsphere** — no point lies strictly inside any tetrahedron's
 *   circumsphere. This is the defining property.
 * - **Volume conservation** — the tetrahedra tile the convex hull exactly, so
 *   their volumes sum to the hull's. This catches both gaps and overlaps,
 *   which the empty-circumsphere check alone would miss.
 */

import { describe, expect, test } from "@rstest/core";
import {
  Delaunay3D,
  type DelaunayPoints,
} from "../../../src/algo/surface/delaunay_3d";

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

function totalVolume(points: DelaunayPoints, d: Delaunay3D): number {
  let total = 0;
  for (const t of d.tetrahedra) {
    const [a, b, c, e] = t.v;
    const bx = points.x[b] - points.x[a];
    const by = points.y[b] - points.y[a];
    const bz = points.z[b] - points.z[a];
    const cx = points.x[c] - points.x[a];
    const cy = points.y[c] - points.y[a];
    const cz = points.z[c] - points.z[a];
    const dx = points.x[e] - points.x[a];
    const dy = points.y[e] - points.y[a];
    const dz = points.z[e] - points.z[a];
    total +=
      Math.abs(
        bx * (cy * dz - cz * dy) -
          by * (cx * dz - cz * dx) +
          bz * (cx * dy - cy * dx),
      ) / 6;
  }
  return total;
}

/** Largest violation of the empty-circumsphere property, relative to r. */
function worstIntrusion(points: DelaunayPoints, d: Delaunay3D): number {
  let worst = 0;
  for (const t of d.tetrahedra) {
    const r = Math.sqrt(t.r2);
    for (let i = 0; i < points.count; i++) {
      if (t.v.includes(i)) continue;
      const dist = Math.hypot(
        points.x[i] - t.cx,
        points.y[i] - t.cy,
        points.z[i] - t.cz,
      );
      worst = Math.max(worst, (r - dist) / Math.max(r, 1e-9));
    }
  }
  return worst;
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

/** Deterministic pseudo-random cloud — no Math.random, so failures repeat. */
function cloud(n: number): DelaunayPoints {
  const coords: Array<[number, number, number]> = [];
  let seed = 12345;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < n; i++) {
    coords.push([next() * 10, next() * 10, next() * 10]);
  }
  return pointsOf(coords);
}

describe("Delaunay3D", () => {
  test("four points form exactly one tetrahedron", () => {
    const tetra = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    const d = new Delaunay3D(tetra);
    expect(d.degenerate).toBe(false);
    expect(d.tetrahedra.length).toBe(1);
    expect(totalVolume(tetra, d)).toBeCloseTo(1 / 6, 9);
  });

  test("a cube's tetrahedra tile it exactly", () => {
    const d = new Delaunay3D(CUBE);
    expect(d.degenerate).toBe(false);
    expect(totalVolume(CUBE, d)).toBeCloseTo(1, 9);
  });

  test("a random cloud satisfies the empty-circumsphere property", () => {
    const points = cloud(200);
    const d = new Delaunay3D(points);
    expect(d.tetrahedra.length).toBeGreaterThan(0);
    expect(worstIntrusion(points, d)).toBeLessThan(1e-6);
  });

  test("an FCC lattice tetrahedralises despite being wall-to-wall degenerate", () => {
    // Perfect crystals are the adversarial input: masses of cospherical and
    // coplanar points that a random cloud never produces.
    const coords: Array<[number, number, number]> = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) {
          coords.push([i, j, k]);
          if (i < 3 && j < 3) coords.push([i + 0.5, j + 0.5, k]);
        }
    const points = pointsOf(coords);
    const d = new Delaunay3D(points);
    expect(d.degenerate).toBe(false);
    // The lattice's convex hull is the 3×3×3 box the corner points span.
    expect(totalVolume(points, d)).toBeCloseTo(27, 6);
  });

  test("the seed hint keeps the fallback scan out of the hot path", () => {
    // A miss is correct but linear; a run full of them is a silent quadratic.
    const d = new Delaunay3D(cloud(300));
    expect(d.seedMisses).toBe(0);
  });

  test("circumradii are consistent with the stored circumcentres", () => {
    const points = cloud(60);
    const d = new Delaunay3D(points);
    for (const t of d.tetrahedra) {
      for (const v of t.v) {
        const dist = Math.hypot(
          points.x[v] - t.cx,
          points.y[v] - t.cy,
          points.z[v] - t.cz,
        );
        expect(dist).toBeCloseTo(Math.sqrt(t.r2), 6);
      }
    }
  });

  test("scale independence — a large cube behaves like a small one", () => {
    const big = pointsOf(
      Array.from(
        { length: CUBE.count },
        (_, i) =>
          [CUBE.x[i] * 500, CUBE.y[i] * 500, CUBE.z[i] * 500] as [
            number,
            number,
            number,
          ],
      ),
    );
    const d = new Delaunay3D(big);
    expect(d.degenerate).toBe(false);
    expect(totalVolume(big, d)).toBeCloseTo(500 ** 3, 0);
  });

  test("coincident points are dropped, not fed in", () => {
    // Duplicates are not distinct Delaunay vertices, and near-coincident
    // pairs spawn slivers with huge circumradii that cascade into a broken
    // triangulation — measured at 7× the expected tetrahedron count and 16×
    // the runtime before they were filtered. Real files supply them: PDB
    // altloc conformers and duplicated records.
    const tetra: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const withDupes = pointsOf([...tetra, ...tetra]);
    const d = new Delaunay3D(withDupes);

    expect(d.duplicatesDropped).toBe(4);
    expect(d.tetrahedra.length).toBe(1);
    expect(totalVolume(withDupes, d)).toBeCloseTo(1 / 6, 9);
  });

  test("distinct-but-close points are kept", () => {
    // 0.1 Å apart is a real separation, not a duplicate; the alpha filter
    // decides whether such a tetrahedron is solid, not the deduplicator.
    const points = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.1, 0.1, 0.1],
    ]);
    expect(new Delaunay3D(points).duplicatesDropped).toBe(0);
  });

  test("fewer than four points is degenerate", () => {
    expect(
      new Delaunay3D(
        pointsOf([
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]),
      ).degenerate,
    ).toBe(true);
  });

  test("coplanar points are degenerate, not a crash", () => {
    const flat = pointsOf([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0.5, 0.5, 0],
    ]);
    expect(new Delaunay3D(flat).degenerate).toBe(true);
  });
});
