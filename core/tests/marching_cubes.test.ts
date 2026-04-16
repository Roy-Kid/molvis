/**
 * Marching Cubes tests.
 *
 * Pipeline tested: WASM Grid → Float32Array → marchingCubes() → MCMesh
 *
 * No BabylonJS dependency — all tests run purely in the rstest environment.
 */

import { Grid } from "@molcrafts/molrs";
import { describe, expect, test } from "@rstest/core";
import "./setup_wasm";
import { marchingCubes } from "../src/algo/marching_cubes";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Identity cell (unit cube), origin at (0,0,0). */
const UNIT_CELL = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const ZERO_ORIGIN = new Float64Array([0, 0, 0]);

/**
 * Create a flat Float32Array of size nx*ny*nz.
 * fill(fn) calls fn(i, j, k) for each voxel.
 */
function makeField(
  nx: number,
  ny: number,
  nz: number,
  fn: (i: number, j: number, k: number) => number,
): Float32Array {
  const data = new Float64Array(nx * ny * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) data[i * ny * nz + j * nz + k] = fn(i, j, k);
  return data;
}

/** Sphere SDF: positive outside, negative inside. */
function sphereField(
  nx: number,
  ny: number,
  nz: number,
  r: number,
): Float32Array {
  const cx = nx / 2;
  const cy = ny / 2;
  const cz = nz / 2;
  return makeField(
    nx,
    ny,
    nz,
    (i, j, k) => Math.sqrt((i - cx) ** 2 + (j - cy) ** 2 + (k - cz) ** 2) - r,
  );
}

/** Check that no value in a Float32Array is NaN or Infinity. */
function hasNoInvalid(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) return false;
  }
  return true;
}

// ── WASM Grid integration ─────────────────────────────────────────────────────

describe("Grid → Float32Array extraction", () => {
  test("getArray returns data matching inserted values", () => {
    const grid = new Grid(4, 4, 4, ZERO_ORIGIN, UNIT_CELL, false, false, false);
    const input = new Float64Array(64).fill(0);
    for (let i = 0; i < 64; i++) input[i] = i * 0.1;
    grid.insertArray("rho", input);

    const output = grid.getArray("rho");
    expect(output).not.toBeUndefined();

    expect(output!.length).toBe(64);
    for (let i = 0; i < 64; i++) {
      expect(output![i]).toBeCloseTo(i * 0.1, 5);
    }
  });

  test("dim() matches constructor arguments", () => {
    const grid = new Grid(5, 6, 7, ZERO_ORIGIN, UNIT_CELL, false, false, false);
    const dim = grid.dim();
    expect(dim[0]).toBe(5);
    expect(dim[1]).toBe(6);
    expect(dim[2]).toBe(7);
  });

  test("total() equals nx * ny * nz", () => {
    const grid = new Grid(3, 4, 5, ZERO_ORIGIN, UNIT_CELL, false, false, false);
    expect(grid.total()).toBe(60);
  });

  test("insertArray throws when data length is wrong", () => {
    const grid = new Grid(2, 2, 2, ZERO_ORIGIN, UNIT_CELL, false, false, false);
    expect(() => grid.insertArray("bad", new Float64Array(7))).toThrow();
  });
});

// ── Marching Cubes: degenerate cases ─────────────────────────────────────────

describe("marchingCubes — degenerate cases", () => {
  test("all-inside field produces empty mesh", () => {
    const data = new Float64Array(8).fill(-1); // all values < isovalue=0
    const mesh = marchingCubes(data, [2, 2, 2], UNIT_CELL, ZERO_ORIGIN, 0);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  test("all-outside field produces empty mesh", () => {
    const data = new Float64Array(8).fill(1); // all values > isovalue=0
    const mesh = marchingCubes(data, [2, 2, 2], UNIT_CELL, ZERO_ORIGIN, 0);
    expect(mesh.positions.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });

  test("single voxel half-inside produces non-empty mesh", () => {
    // 2×2×2 grid: corner 0 inside, rest outside
    const data = new Float64Array(8).fill(1);
    data[0] = -1; // vertex (0,0,0) inside
    const mesh = marchingCubes(data, [2, 2, 2], UNIT_CELL, ZERO_ORIGIN, 0);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);
  });
});

// ── Marching Cubes: sphere field ──────────────────────────────────────────────

describe("marchingCubes — sphere field", () => {
  const nx = 20;
  const ny = 20;
  const nz = 20;
  const r = 6; // radius in grid units
  const data = sphereField(nx, ny, nz, r);
  const mesh = marchingCubes(data, [nx, ny, nz], UNIT_CELL, ZERO_ORIGIN, 0);

  test("produces non-empty mesh", () => {
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });

  test("positions.length is multiple of 3", () => {
    expect(mesh.positions.length % 3).toBe(0);
  });

  test("indices.length is multiple of 3", () => {
    expect(mesh.indices.length % 3).toBe(0);
  });

  test("normals.length equals positions.length", () => {
    expect(mesh.normals.length).toBe(mesh.positions.length);
  });

  test("no NaN or Infinity in positions", () => {
    expect(hasNoInvalid(mesh.positions)).toBe(true);
  });

  test("no NaN or Infinity in normals", () => {
    expect(hasNoInvalid(mesh.normals)).toBe(true);
  });

  test("all indices are within bounds", () => {
    const nVerts = mesh.positions.length / 3;
    for (let i = 0; i < mesh.indices.length; i++) {
      expect(mesh.indices[i]).toBeLessThan(nVerts);
    }
  });

  test("normals are unit length", () => {
    const ns = mesh.normals;
    for (let i = 0; i < ns.length; i += 3) {
      const len = Math.sqrt(ns[i] ** 2 + ns[i + 1] ** 2 + ns[i + 2] ** 2);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  test("vertex positions lie near the sphere surface (unit cell)", () => {
    // In unit cell coords, sphere center is at (nx/2, ny/2, nz/2)/nx = (0.5,0.5,0.5)
    // radius in world coords = r/nx (since cell is identity scaled by 1, not by nx)
    // Actually with identity cell and origin at 0, world pos = frac = grid_index/n
    // So sphere center in world = (0.5, 0.5, 0.5), radius = r/nx = 0.3
    const cx = 0.5;
    const cy = 0.5;
    const cz = 0.5;
    const rWorld = r / nx;
    const ps = mesh.positions;
    let maxErr = 0;
    for (let i = 0; i < ps.length; i += 3) {
      const dx = ps[i] - cx;
      const dy = ps[i + 1] - cy;
      const dz = ps[i + 2] - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      maxErr = Math.max(maxErr, Math.abs(dist - rWorld));
    }
    // MC interpolation error should be < 1 cell width = 1/nx
    expect(maxErr).toBeLessThan(1 / nx);
  });
});

// ── Marching Cubes: coordinate transform ─────────────────────────────────────

describe("marchingCubes — coordinate transform", () => {
  test("axis-aligned plane in x produces vertices at correct x world coords", () => {
    // 4×4×4 field: values = i (linear in i direction)
    // isovalue = 2.0 → surface at i=2, fractional fi=2/4=0.5
    // With cell = diag(2,2,2): world_x = 0 + fi*2 = 1.0
    const nx = 4;
    const ny = 4;
    const nz = 4;
    const data = makeField(nx, ny, nz, (i) => i as number);
    const cell = new Float64Array([2, 0, 0, 0, 2, 0, 0, 0, 2]);
    const mesh = marchingCubes(data, [nx, ny, nz], cell, ZERO_ORIGIN, 2.0);

    expect(mesh.positions.length).toBeGreaterThan(0);
    const ps = mesh.positions;
    for (let i = 0; i < ps.length; i += 3) {
      // All vertices should have x ≈ 1.0 (isovalue=2 at fractional 0.5, world=0.5*2=1)
      expect(ps[i]).toBeCloseTo(1.0, 3);
    }
  });

  test("non-unit origin shifts all vertex positions", () => {
    const nx = 4;
    const ny = 4;
    const nz = 4;
    const data = makeField(nx, ny, nz, (i) => i as number);
    const origin = new Float64Array([10, 20, 30]);
    const mesh0 = marchingCubes(
      data,
      [nx, ny, nz],
      UNIT_CELL,
      ZERO_ORIGIN,
      2.0,
    );
    const meshO = marchingCubes(data, [nx, ny, nz], UNIT_CELL, origin, 2.0);

    expect(mesh0.positions.length).toBe(meshO.positions.length);
    for (let i = 0; i < mesh0.positions.length; i += 3) {
      expect(meshO.positions[i]).toBeCloseTo(mesh0.positions[i] + 10, 3);
      expect(meshO.positions[i + 1]).toBeCloseTo(
        mesh0.positions[i + 1] + 20,
        3,
      );
      expect(meshO.positions[i + 2]).toBeCloseTo(
        mesh0.positions[i + 2] + 30,
        3,
      );
    }
  });
});

// ── End-to-end: Grid → MC ─────────────────────────────────────────────────────

describe("Grid → marchingCubes end-to-end", () => {
  test("sphere stored in WASM Grid produces valid isosurface", () => {
    const nx = 16;
    const ny = 16;
    const nz = 16;
    const r = 5;
    const raw = sphereField(nx, ny, nz, r);

    // Store in WASM Grid
    const grid = new Grid(
      nx,
      ny,
      nz,
      ZERO_ORIGIN,
      UNIT_CELL,
      false,
      false,
      false,
    );
    grid.insertArray("sdf", raw);

    // Extract from WASM (getArray returns Float64Array directly)
    const data = grid.getArray("sdf")!;

    // Read cell and origin from Grid
    const cellWasm = grid.cell().toCopy();
    const originWasm = grid.origin().toCopy();

    // Run MC
    const dim = grid.dim();
    const mesh = marchingCubes(
      data,
      [dim[0], dim[1], dim[2]],
      cellWasm,
      originWasm,
      0,
    );

    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);
    expect(hasNoInvalid(mesh.positions)).toBe(true);
    expect(hasNoInvalid(mesh.normals)).toBe(true);

    const nVerts = mesh.positions.length / 3;
    for (let i = 0; i < mesh.indices.length; i++) {
      expect(mesh.indices[i]).toBeLessThan(nVerts);
    }
  });
});
