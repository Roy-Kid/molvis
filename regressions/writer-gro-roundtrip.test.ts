/**
 * Regression: GRO writer round-trip through the public IO boundary.
 *
 * Hard-coded goldens (no live third-party oracles):
 * - atom count after write→read
 * - HW1 x-coordinate after nm↔Å scaling both ways (0.100 nm → 1.0 Å)
 *
 * Provenance: fixtures mirror molrs `gro.rs` `water_gro`; golden values
 * captured from core integration suite writer_roundtrip (2026-07-22).
 *
 * Public surface: `@molcrafts/molvis-stage` IO (`loadTextTrajectory`,
 * `writeFrame`) — imported via source paths for the monorepo runner.
 *
 * Run from repo root:
 *   npm run test:regressions
 * or:
 *   npm run test -w core -- -- ../regressions/writer-gro-roundtrip.test.ts
 */

import { describe, expect, it } from "@rstest/core";
// Paths relative to monorepo root (see core/rstest.regressions.config.ts root).
import { loadTextTrajectory } from "../stage/src/io/reader";
import { writeFrame } from "../stage/src/io/writer";

/** Mirrors molrs gro water fixture (fixed 44-column atom rows). */
const WATER_GRO = `Water box
    3
    1WAT     OW    1   0.000   0.000   0.000
    1WAT    HW1    2   0.100   0.000   0.000
    1WAT    HW2    3   0.000   0.100   0.000
   2.00000   2.00000   2.00000
`;

/** Hard-coded golden: post-load HW1 x in angstrom. */
const GOLDEN_HW1_X_A = 1.0;
const GOLDEN_N_ATOMS = 3;

describe("regression: GRO writer round-trip", () => {
  it("preserves atom count and HW1 x after angstrom↔nm round-trip", () => {
    const loaded = loadTextTrajectory(WATER_GRO, "in.gro");
    try {
      const frame = loaded.trajectory.get(0);
      if (!frame) throw new Error("no source frame");

      const payload = writeFrame(frame, {
        format: "gro",
        filename: "out.gro",
      });
      const content =
        typeof payload.content === "string"
          ? payload.content
          : new TextDecoder().decode(payload.content as Uint8Array);

      const round = loadTextTrajectory(content, "out.gro");
      try {
        const atoms = round.trajectory.get(0)?.getBlock("atoms");
        const x = atoms?.copyColF("x");

        expect(atoms?.nrows()).toBe(GOLDEN_N_ATOMS);
        // Hard-coded: 0.100 nm → 1.0 Å both on load and after write→load.
        expect(x?.[1]).toBeCloseTo(GOLDEN_HW1_X_A, 4);
      } finally {
        round.dispose();
      }
    } finally {
      loaded.dispose();
    }
  });
});
