/**
 * GridDomain tests — voxel layout, padding, and the voxel-count clamp.
 *
 * No molrs types involved: the domain is plain arithmetic over coordinates.
 */

import { describe, expect, test } from "@rstest/core";
import { GridDomain, MAX_VOXELS } from "../../../src/algo/surface/grid_domain";

/** Two atoms 10 Å apart along x. */
const X = [0, 10];
const Y = [0, 0];
const Z = [0, 0];

describe("GridDomain", () => {
  test("honours the requested spacing", () => {
    const d = new GridDomain(X, Y, Z, 2, { pad: 2, spacing: 0.5 });
    expect(d.spacing).toBeCloseTo(0.5, 12);
    expect(d.clamped).toBe(false);
  });

  test("origin sits one pad below the atom AABB", () => {
    const d = new GridDomain(X, Y, Z, 2, { pad: 2, spacing: 0.5 });
    expect(d.origin[0]).toBeCloseTo(-2, 12);
    expect(d.origin[1]).toBeCloseTo(-2, 12);
  });

  test("grid spans the padded AABB", () => {
    const pad = 2;
    const d = new GridDomain(X, Y, Z, 2, { pad, spacing: 0.5 });
    // Last voxel must reach at least the far padded edge (10 + pad).
    expect(d.worldX(d.nx - 1)).toBeGreaterThanOrEqual(10 + pad);
  });

  test("cell spans the whole domain, matching the i/nx voxel convention", () => {
    const d = new GridDomain(X, Y, Z, 2, { pad: 2, spacing: 0.5 });
    // world = origin + (i/nx)*col0, so col0 must equal nx*spacing.
    expect(d.cell[0]).toBeCloseTo(d.nx * d.spacing, 12);
    expect(d.cell[4]).toBeCloseTo(d.ny * d.spacing, 12);
    expect(d.cell[8]).toBeCloseTo(d.nz * d.spacing, 12);
    // Off-diagonals are zero: the domain is axis-aligned, never triclinic.
    expect(d.cell[1]).toBe(0);
    expect(d.cell[5]).toBe(0);
  });

  test("follows the atoms, never a crystal-cell origin", () => {
    // ASU-style coordinates sitting outside a [0,100] cell. The domain must
    // track the protein; depositing on frame.box would fold these into the
    // primary cell and leave the surface detached from the atoms.
    const pad = 3;
    const d = new GridDomain(
      [-30, -20, -25],
      [-50, -40, -45],
      [-10, -5, -8],
      3,
      { pad, spacing: 0.5 },
    );
    expect(d.origin[0]).toBeCloseTo(-30 - pad, 6);
    expect(d.origin[1]).toBeCloseTo(-50 - pad, 6);
    expect(d.origin[2]).toBeCloseTo(-10 - pad, 6);
    // Each axis covers its padded extent, rounded up to a whole voxel.
    expect(d.cell[0]).toBeGreaterThanOrEqual(10 + 2 * pad);
    expect(d.cell[0]).toBeLessThan(10 + 2 * pad + 2 * d.spacing);
    expect(d.cell[8]).toBeGreaterThanOrEqual(5 + 2 * pad);
  });

  test("index() is row-major with ix outermost", () => {
    const d = new GridDomain(X, Y, Z, 2, { pad: 2, spacing: 0.5 });
    expect(d.index(0, 0, 0)).toBe(0);
    expect(d.index(0, 0, 1)).toBe(1);
    expect(d.index(0, 1, 0)).toBe(d.nz);
    expect(d.index(1, 0, 0)).toBe(d.ny * d.nz);
  });

  test("a lone atom still gets a meshable grid", () => {
    const d = new GridDomain([0], [0], [0], 1, { pad: 0, spacing: 0.5 });
    expect(d.nx).toBeGreaterThanOrEqual(2);
    expect(d.ny).toBeGreaterThanOrEqual(2);
    expect(d.nz).toBeGreaterThanOrEqual(2);
  });

  test("no atoms degrades to a unit domain instead of NaN", () => {
    const d = new GridDomain([], [], [], 0, { pad: 1, spacing: 0.5 });
    expect(Number.isFinite(d.origin[0])).toBe(true);
    expect(d.voxelCount).toBeGreaterThan(0);
  });

  test("a too-fine resolution is coarsened and reports it", () => {
    const d = new GridDomain([0, 100], [0, 100], [0, 100], 2, {
      pad: 2,
      spacing: 0.05,
    });
    expect(d.clamped).toBe(true);
    expect(d.spacing).toBeGreaterThan(0.05);
    expect(d.voxelCount).toBeLessThanOrEqual(MAX_VOXELS);
  });

  test("a resolution that already fits is left exactly alone", () => {
    const d = new GridDomain(X, Y, Z, 2, { pad: 2, spacing: 0.4 });
    expect(d.clamped).toBe(false);
    expect(d.spacing).toBe(0.4);
  });
});
