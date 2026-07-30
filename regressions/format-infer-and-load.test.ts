/**
 * Regression: format inference + minimal text load (public IO / formats API).
 *
 * Hard-coded goldens:
 * - inferFormatFromFilename for gro / mol2 / poscar basenames
 * - GRO load: 3 atoms, HW1 x = 1.0 Å (nm→Å)
 * - MOL2 load: 2 atoms, 1 bond, C2 x = 1.5 Å
 * - POSCAR load: 2 atoms, N site x = 1.25 Å (fractional→Cartesian)
 *
 * Provenance: fixtures mirror molrs unit fixtures (water_gro, ETHANE_MIN,
 * POSCAR_BN); goldens from core integration gromacs_vasp_load (2026-07-22).
 *
 * Run from repo root:
 *   npm run test:regressions
 */

import { describe, expect, it } from "@rstest/core";
// Paths relative to this file under monorepo root (rstest.regressions.config.ts).
import { inferFormatFromFilename } from "../stage/src/io/formats";
import { loadTextTrajectory } from "../stage/src/io/reader";

const WATER_GRO = `Water box
    3
    1WAT     OW    1   0.000   0.000   0.000
    1WAT    HW1    2   0.100   0.000   0.000
    1WAT    HW2    3   0.000   0.100   0.000
   2.00000   2.00000   2.00000
`;

const ETHANE_MOL2 = `@<TRIPOS>MOLECULE
ETH
2 1 1 0 0
SMALL
NO_CHARGES
@<TRIPOS>ATOM
1 C1 0.0 0.0 0.0 c3 1 ETH 0.0
2 C2 1.5 0.0 0.0 c3 1 ETH 0.0
@<TRIPOS>BOND
1 1 2 1
`;

const BN_POSCAR = `BN bulk
1.0
2.5  0.0  0.0
0.0  2.5  0.0
0.0  0.0  2.5
B N
1 1
Direct
0.0 0.0 0.0
0.5 0.5 0.5
`;

describe("regression: format infer (hard-coded)", () => {
  it("maps extensions and VASP basenames", () => {
    expect(inferFormatFromFilename("conf.gro")).toBe("gro");
    expect(inferFormatFromFilename("ligand.mol2")).toBe("mol2");
    expect(inferFormatFromFilename("foo.poscar")).toBe("poscar");
    expect(inferFormatFromFilename("POSCAR")).toBe("poscar");
    expect(inferFormatFromFilename("CONTCAR")).toBe("poscar");
    expect(inferFormatFromFilename("/path/to/POSCAR")).toBe("poscar");
  });
});

describe("regression: minimal load goldens", () => {
  it("GRO: 3 atoms, HW1 x = 1.0 Å", () => {
    const bundle = loadTextTrajectory(WATER_GRO, "water.gro");
    try {
      const atoms = bundle.trajectory.get(0)?.getBlock("atoms");
      expect(atoms?.nrows()).toBe(3);
      expect(atoms?.copyColF("x")?.[1]).toBeCloseTo(1.0, 6);
    } finally {
      bundle.dispose();
    }
  });

  it("MOL2: 2 atoms, 1 bond, C2 x = 1.5 Å", () => {
    const bundle = loadTextTrajectory(ETHANE_MOL2, "ethane.mol2");
    try {
      const frame = bundle.trajectory.get(0);
      expect(frame?.getBlock("atoms")?.nrows()).toBe(2);
      expect(frame?.getBlock("bonds")?.nrows()).toBe(1);
      expect(frame?.getBlock("atoms")?.copyColF("x")?.[1]).toBeCloseTo(1.5, 6);
    } finally {
      bundle.dispose();
    }
  });

  it("POSCAR: 2 atoms, fractional mid-site x = 1.25 Å", () => {
    const bundle = loadTextTrajectory(BN_POSCAR, "BN.poscar");
    try {
      const atoms = bundle.trajectory.get(0)?.getBlock("atoms");
      expect(atoms?.nrows()).toBe(2);
      expect(atoms?.copyColF("x")?.[1]).toBeCloseTo(1.25, 6);
    } finally {
      bundle.dispose();
    }
  });
});
