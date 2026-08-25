/**
 * HullSurface tests — the convex envelope of a molecule.
 *
 * The point of sampling spheres rather than hulling bare centres is that the
 * result respects atom radii and stays solid for flat molecules; both are
 * asserted here.
 */

import { describe, expect, test } from "@rstest/core";
import { HullSurface } from "../../../src/algo/surface/hull_surface";

const CARBON_VDW = 1.91;

function volumeOf(mesh: {
  positions: Float32Array;
  indices: Uint32Array;
}): number {
  let total = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t] * 3;
    const b = mesh.indices[t + 1] * 3;
    const c = mesh.indices[t + 2] * 3;
    const [ax, ay, az] = [
      mesh.positions[a],
      mesh.positions[a + 1],
      mesh.positions[a + 2],
    ];
    const [bx, by, bz] = [
      mesh.positions[b],
      mesh.positions[b + 1],
      mesh.positions[b + 2],
    ];
    const [cx, cy, cz] = [
      mesh.positions[c],
      mesh.positions[c + 1],
      mesh.positions[c + 2],
    ];
    total +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return total / 6;
}

const LONE_CARBON = {
  x: [0],
  y: [0],
  z: [0],
  count: 1,
  elements: ["C"],
} as const;

describe("HullSurface", () => {
  test("a single atom becomes a solid approximating its vdW sphere", () => {
    const hull = new HullSurface(LONE_CARBON, { radiusScale: 1 });
    expect(hull.degenerate).toBe(false);

    const sphere = (4 / 3) * Math.PI * CARBON_VDW ** 3;
    const volume = volumeOf(hull.mesh);
    // An inscribed polyhedron: below the sphere, but not far below.
    expect(volume).toBeLessThan(sphere);
    expect(volume).toBeGreaterThan(sphere * 0.85);
  });

  test("a flat molecule still gets a solid envelope", () => {
    // Benzene's carbons are coplanar, so a hull of bare centres would have
    // zero volume and draw nothing at all.
    const ring = {
      x: [] as number[],
      y: [] as number[],
      z: [] as number[],
      count: 6,
      elements: [] as string[],
    };
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ring.x.push(1.39 * Math.cos(angle));
      ring.y.push(1.39 * Math.sin(angle));
      ring.z.push(0);
      ring.elements.push("C");
    }

    const hull = new HullSurface(ring, { radiusScale: 1 });
    expect(hull.degenerate).toBe(false);
    expect(volumeOf(hull.mesh)).toBeGreaterThan(0);
  });

  test("radius scale changes the volume by the cube of the scale", () => {
    const full = volumeOf(
      new HullSurface(LONE_CARBON, { radiusScale: 1 }).mesh,
    );
    const half = volumeOf(
      new HullSurface(LONE_CARBON, { radiusScale: 0.5 }).mesh,
    );
    expect(half).toBeCloseTo(full * 0.125, 4);
  });

  test("two atoms give a hull enclosing both", () => {
    const pair = {
      x: [0, 5],
      y: [0, 0],
      z: [0, 0],
      count: 2,
      elements: ["C", "C"],
    };
    const hull = new HullSurface(pair, { radiusScale: 1 });
    expect(hull.degenerate).toBe(false);

    let maxX = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < hull.mesh.positions.length; i += 3) {
      maxX = Math.max(maxX, hull.mesh.positions[i]);
    }
    // Sampling never lands exactly on +x, so the hull falls short of the
    // true extent by the documented faceting error, r·(1 − cos(θ/2)).
    const facetingBound = CARBON_VDW * 0.06;
    expect(maxX).toBeLessThanOrEqual(5 + CARBON_VDW);
    expect(maxX).toBeGreaterThan(5 + CARBON_VDW - facetingBound);
  });

  test("a frame without elements reports the uniform-radius fallback", () => {
    const hull = new HullSurface(
      { x: [0], y: [0], z: [0], count: 1 },
      { radiusScale: 1 },
    );
    expect(hull.usedFallbackRadius).toBe(true);
    expect(hull.degenerate).toBe(false);
  });

  test("no atoms is degenerate rather than a crash", () => {
    const hull = new HullSurface(
      { x: [], y: [], z: [], count: 0 },
      { radiusScale: 1 },
    );
    expect(hull.degenerate).toBe(true);
    expect(hull.mesh.indices.length).toBe(0);
  });
});
