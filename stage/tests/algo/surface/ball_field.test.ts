/**
 * BallField tests — the positive-inside union-of-balls field.
 */

import { describe, expect, test } from "@rstest/core";
import { BallField } from "../../../src/algo/surface/ball_field";
import { GridDomain } from "../../../src/algo/surface/grid_domain";
import { crossingDistance, nearestIndex } from "./field_probe";

const SPACING = 0.1;

function singleAtomDomain(radius: number): GridDomain {
  return new GridDomain([0], [0], [0], 1, {
    pad: radius + 1,
    spacing: SPACING,
  });
}

describe("BallField", () => {
  test("peaks at the ball radius on the atom centre", () => {
    const domain = singleAtomDomain(2);
    const field = new BallField(domain, {
      x: [0],
      y: [0],
      z: [0],
      count: 1,
      radii: [2],
    });
    const [i, j, k] = nearestIndex(domain, [0, 0, 0]);
    // The nearest voxel is at most half a spacing off centre.
    expect(field.values[domain.index(i, j, k)]).toBeGreaterThan(2 - SPACING);
    expect(field.values[domain.index(i, j, k)]).toBeLessThanOrEqual(2);
  });

  test("crosses zero at the ball radius", () => {
    const domain = singleAtomDomain(2);
    const field = new BallField(domain, {
      x: [0],
      y: [0],
      z: [0],
      count: 1,
      radii: [2],
    });
    expect(crossingDistance(domain, field.values, [0, 0, 0])).toBeCloseTo(2, 1);
  });

  test("radius drives the crossing, not the grid", () => {
    for (const radius of [1, 1.5, 2.5]) {
      const domain = singleAtomDomain(radius);
      const field = new BallField(domain, {
        x: [0],
        y: [0],
        z: [0],
        count: 1,
        radii: [radius],
      });
      expect(crossingDistance(domain, field.values, [0, 0, 0])).toBeCloseTo(
        radius,
        1,
      );
    }
  });

  test("far voxels hold the floor, which equals the window-edge value", () => {
    const domain = singleAtomDomain(1);
    const field = new BallField(domain, {
      x: [0],
      y: [0],
      z: [0],
      count: 1,
      radii: [1],
    });
    expect(field.floor).toBeCloseTo(-2 * SPACING, 12);
    // Corner of the domain is well outside the ball window.
    expect(field.values[domain.index(0, 0, 0)]).toBeCloseTo(field.floor, 12);
  });

  test("two overlapping balls fuse: the midpoint stays inside", () => {
    const domain = new GridDomain([0, 2], [0, 0], [0, 0], 2, {
      pad: 3,
      spacing: SPACING,
    });
    const field = new BallField(domain, {
      x: [0, 2],
      y: [0, 0],
      z: [0, 0],
      count: 2,
      radii: [1.5, 1.5],
    });
    const [i, j, k] = nearestIndex(domain, [1, 0, 0]);
    expect(field.values[domain.index(i, j, k)]).toBeGreaterThan(0);
  });

  test("two distant balls stay separate: the midpoint is outside", () => {
    const domain = new GridDomain([0, 8], [0, 0], [0, 0], 2, {
      pad: 3,
      spacing: SPACING,
    });
    const field = new BallField(domain, {
      x: [0, 8],
      y: [0, 0],
      z: [0, 0],
      count: 2,
      radii: [1.5, 1.5],
    });
    const [i, j, k] = nearestIndex(domain, [4, 0, 0]);
    expect(field.values[domain.index(i, j, k)]).toBeLessThan(0);
  });

  test("a zero-radius atom contributes nothing", () => {
    const domain = singleAtomDomain(2);
    const field = new BallField(domain, {
      x: [0],
      y: [0],
      z: [0],
      count: 1,
      radii: [0],
    });
    for (const v of field.values) expect(v).toBeCloseTo(field.floor, 12);
  });
});
