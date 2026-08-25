/**
 * SolventSurface tests — the vdW / SAS / SES family.
 *
 * Each mode has an analytic answer for an isolated atom, so the crossing
 * radius is checked against it rather than against a golden mesh:
 *
 *   vdW  → r
 *   SAS  → r + probe
 *   SES  → r          (an isolated atom has no crevice for the probe to bridge)
 */

import { describe, expect, test } from "@rstest/core";
import { SolventSurface } from "../../../src/algo/surface/solvent_surface";
import { crossingDistance, nearestIndex } from "./field_probe";

const CARBON_VDW = 1.91;
const PROBE = 1.4;

/** One carbon at the origin. */
const LONE_ATOM = {
  x: [0],
  y: [0],
  z: [0],
  count: 1,
  elements: ["C"],
} as const;

const BASE = { resolution: 0.15, probeRadius: PROBE, radiusScale: 1 };

describe("SolventSurface", () => {
  test("vdw crosses zero at the van der Waals radius", () => {
    const s = new SolventSurface(LONE_ATOM, { ...BASE, mode: "vdw" });
    expect(crossingDistance(s.domain, s.values, [0, 0, 0])).toBeCloseTo(
      CARBON_VDW,
      1,
    );
  });

  test("sas is inflated by exactly one probe radius", () => {
    const s = new SolventSurface(LONE_ATOM, { ...BASE, mode: "sas" });
    expect(crossingDistance(s.domain, s.values, [0, 0, 0])).toBeCloseTo(
      CARBON_VDW + PROBE,
      1,
    );
  });

  test("ses of an isolated atom returns to the van der Waals radius", () => {
    const s = new SolventSurface(LONE_ATOM, { ...BASE, mode: "ses" });
    expect(crossingDistance(s.domain, s.values, [0, 0, 0])).toBeCloseTo(
      CARBON_VDW,
      1,
    );
  });

  test("ses stays on the van der Waals radius as the grid coarsens", () => {
    // The distance transform measures to voxel centres, which inflates SES by
    // half a spacing. If that correction were mistuned the error would grow
    // with the spacing, so two resolutions an octave apart pin it down.
    for (const resolution of [0.1, 0.2, 0.4]) {
      const s = new SolventSurface(LONE_ATOM, {
        ...BASE,
        mode: "ses",
        resolution,
      });
      const r = crossingDistance(s.domain, s.values, [0, 0, 0]);
      expect(Math.abs(r - CARBON_VDW)).toBeLessThan(0.5 * resolution);
    }
  });

  test("radius scale moves the vdw crossing proportionally", () => {
    const s = new SolventSurface(LONE_ATOM, {
      ...BASE,
      mode: "vdw",
      radiusScale: 0.5,
    });
    expect(crossingDistance(s.domain, s.values, [0, 0, 0])).toBeCloseTo(
      CARBON_VDW * 0.5,
      1,
    );
  });

  test("ses fills a crevice the probe cannot enter, sas does not", () => {
    // Two carbons 4.6 Å apart: the gap between their vdW shells is
    // 4.6 - 2*1.91 = 0.78 Å, far narrower than a 1.4 Å probe, so SES must
    // bridge it while the plain vdW field leaves it open.
    const pair = {
      x: [0, 4.6],
      y: [0, 0],
      z: [0, 0],
      count: 2,
      elements: ["C", "C"],
    } as const;
    const midpoint = [2.3, 0, 0] as const;

    const vdw = new SolventSurface(pair, { ...BASE, mode: "vdw" });
    const ses = new SolventSurface(pair, { ...BASE, mode: "ses" });

    const vdwIdx = nearestIndex(vdw.domain, midpoint);
    const sesIdx = nearestIndex(ses.domain, midpoint);
    expect(vdw.values[vdw.domain.index(...vdwIdx)]).toBeLessThan(0);
    expect(ses.values[ses.domain.index(...sesIdx)]).toBeGreaterThan(0);
  });

  test("ses leaves a genuinely open gap open", () => {
    // 8 Å apart: the probe fits between them with room to spare.
    const pair = {
      x: [0, 8],
      y: [0, 0],
      z: [0, 0],
      count: 2,
      elements: ["C", "C"],
    } as const;
    const ses = new SolventSurface(pair, { ...BASE, mode: "ses" });
    const idx = nearestIndex(ses.domain, [4, 0, 0]);
    expect(ses.values[ses.domain.index(...idx)]).toBeLessThan(0);
  });

  test("a probe too small for the grid degrades to vdw instead of nonsense", () => {
    const ses = new SolventSurface(LONE_ATOM, {
      ...BASE,
      mode: "ses",
      probeRadius: 0,
    });
    expect(crossingDistance(ses.domain, ses.values, [0, 0, 0])).toBeCloseTo(
      CARBON_VDW,
      1,
    );
  });

  test("a frame without elements reports the uniform-radius fallback", () => {
    const s = new SolventSurface(
      { x: [0], y: [0], z: [0], count: 1 },
      { ...BASE, mode: "vdw" },
    );
    expect(s.usedFallbackRadius).toBe(true);
  });

  test("elements present means no fallback", () => {
    const s = new SolventSurface(LONE_ATOM, { ...BASE, mode: "vdw" });
    expect(s.usedFallbackRadius).toBe(false);
  });
});
