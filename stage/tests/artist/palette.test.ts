import { describe, expect, it } from "@rstest/core";
import { categoricalSequence } from "../../src/artist/categorical_palette";
import {
  buildCategoricalColorLookup,
  categoricalColorAt,
  getPaletteDefinition,
  hexToLinearRgb,
  listContinuousColorMaps,
  listPaletteDefinitions,
} from "../../src/artist/palette";

describe("categorical palettes", () => {
  it("assigns dataset-level categorical colors independently of row order", () => {
    const a = buildCategoricalColorLookup(["opls_146", "opls_145", "opls_147"]);
    const b = buildCategoricalColorLookup(["opls_147", "opls_145", "opls_146"]);

    for (const key of ["opls_145", "opls_146", "opls_147"]) {
      expect(a.get(key)).toEqual(b.get(key));
    }
  });

  it("uses natural ordering when assigning categorical colors", () => {
    // The point is the ordering — `opls_2` before `opls_10`, which plain
    // lexicographic sorting gets backwards. Asserted against the generated
    // sequence rather than a named palette so it keeps testing ordering and
    // not which palette happens to supply the colors.
    const sequence = categoricalSequence(3, {
      background: hexToLinearRgb("#17171C"),
    });
    const lookup = buildCategoricalColorLookup(["opls_10", "opls_2", "opls_1"]);
    expect(lookup.get("opls_1")).toEqual(sequence[0]);
    expect(lookup.get("opls_2")).toEqual(sequence[1]);
    expect(lookup.get("opls_10")).toEqual(sequence[2]);
  });

  it("keeps a single internal continuous ramp for numeric data", () => {
    expect(listContinuousColorMaps()).toEqual(["viridis"]);
  });

  it("returns palette summaries and definitions for public palettes", () => {
    expect(listPaletteDefinitions()).toEqual([
      { name: "cpk", kind: "element", size: 118 },
      { name: "ovito", kind: "element", size: 118 },
      { name: "vivid", kind: "element", size: 118 },
    ]);

    const cpk = getPaletteDefinition("cpk");
    expect(cpk.entries[0]).toEqual({ label: "H", color: "#FFFFFF" });
  });

  it("categoricalColorAt is deterministic and distinct for first swatches", () => {
    expect(categoricalColorAt(0)).toEqual(categoricalColorAt(0));
    expect(categoricalColorAt(0)).not.toEqual(categoricalColorAt(1));
  });

  it("uses Jmol medium grey for element C (cpk / vivid / ovito)", () => {
    for (const name of ["cpk", "vivid", "ovito"] as const) {
      const def = getPaletteDefinition(name);
      const c = def.entries.find((e) => e.label === "C");
      const h = def.entries.find((e) => e.label === "H");
      expect(c?.color).toBe("#909090");
      expect(h?.color).toBe("#FFFFFF");
    }
  });
});

describe("hexToLinearRgb", () => {
  it("converts black correctly", () => {
    const [r, g, b] = hexToLinearRgb("#000000");
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it("converts white correctly", () => {
    const [r, g, b] = hexToLinearRgb("#FFFFFF");
    expect(r).toBeCloseTo(1, 3);
    expect(g).toBeCloseTo(1, 3);
    expect(b).toBeCloseTo(1, 3);
  });

  it("returns values in [0, 1]", () => {
    const [r, g, b] = hexToLinearRgb("#8844CC");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("applies sRGB-to-linear conversion (not just divide by 255)", () => {
    const [r] = hexToLinearRgb("#808080");
    expect(r).toBeLessThan(0.3);
    expect(r).toBeGreaterThan(0.15);
  });

  it("handles hex without # prefix", () => {
    const [r1, g1, b1] = hexToLinearRgb("#FF0000");
    const [r2, g2, b2] = hexToLinearRgb("FF0000");
    expect(r1).toBeCloseTo(r2, 5);
    expect(g1).toBeCloseTo(g2, 5);
    expect(b1).toBeCloseTo(b2, 5);
  });
});
