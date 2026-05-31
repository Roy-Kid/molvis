import { buildSourceColorLegend, getCategoricalPalette } from "@molvis/core";
import { describe, expect, it } from "@rstest/core";
import {
  buildSourceLegend,
  formatRmsd,
  getReferenceableBranches,
} from "../src/ui/modes/view/modifiers/combine_systems_logic";

// Pure-logic unit tests for the combine-systems modifier panel.
// These cover the three side-effect-free helpers only — the React
// component, the hook, and ModifierProperties wiring are verified by
// typecheck / ui_runtime, not here.

describe("getReferenceableBranches (ac-001)", () => {
  const allModifiers = [
    { id: "self", name: "Combine" },
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
  ];

  it("ac-001: excludes self and any rejected id", () => {
    expect(getReferenceableBranches("self", allModifiers, ["b"])).toEqual([
      { id: "a", name: "Alpha" },
    ]);
  });

  it("ac-001: with no rejected ids keeps every branch except self", () => {
    expect(getReferenceableBranches("self", allModifiers, [])).toEqual([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
    ]);
  });

  it("ac-001: returns [] when every non-self branch is rejected", () => {
    expect(getReferenceableBranches("self", allModifiers, ["a", "b"])).toEqual(
      [],
    );
  });
});

describe("formatRmsd (ac-002)", () => {
  it("ac-002: formats a finite value to 3 decimals with Å", () => {
    expect(formatRmsd(1.2345)).toBe("1.234 Å");
  });

  it("ac-002: renders zero as 0.000 Å", () => {
    expect(formatRmsd(0)).toBe("0.000 Å");
  });

  it("ac-002: renders null as an em dash", () => {
    expect(formatRmsd(null)).toBe("—");
  });

  it("ac-002: renders non-finite NaN as an em dash", () => {
    expect(formatRmsd(Number.NaN)).toBe("—");
  });
});

describe("buildSourceLegend (ac-003)", () => {
  it("ac-003: returns [] for empty input", () => {
    expect(buildSourceLegend([])).toEqual([]);
  });

  it("ac-003: one entry per branch id, label === id, hex-format color", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    expect(legend).toHaveLength(3);
    expect(legend.map((entry) => entry.label)).toEqual(["x", "y", "z"]);
    for (const entry of legend) {
      expect(entry.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("ac-003: assigns distinct colors to distinct ordinals", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    const colors = legend.map((entry) => entry.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("ac-003: colors match the core categorical palette ordinals", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    const coreHexes = buildSourceColorLegend([0, 1, 2]).map(
      (entry) => entry.hex,
    );
    expect(legend.map((entry) => entry.color)).toEqual(coreHexes);
  });

  it("ac-003: wraps colors past the categorical palette length", () => {
    const paletteLength = getCategoricalPalette().length;
    const ids = Array.from({ length: paletteLength + 1 }, (_, i) => `id-${i}`);
    const legend = buildSourceLegend(ids);
    expect(legend).toHaveLength(paletteLength + 1);
    expect(legend[paletteLength].color).toBe(legend[0].color);
  });
});
