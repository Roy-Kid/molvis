import { Block, Frame } from "@molcrafts/molrs";
import {
  buildSourceColorLegend,
  FileDataSource,
  getCategoricalPalette,
  MemoryDataSource,
  type Modifier,
  Trajectory,
} from "@molvis/core";
import { describe, expect, it } from "@rstest/core";
import {
  buildSourceLegend,
  formatRmsd,
  selectEnabledDataSources,
} from "../src/ui/modes/view/modifiers/scene_synthesis_logic";

// Pure-logic unit tests for the scene-synthesis panel.
// These cover the three side-effect-free helpers only — the React
// component, the hook, and PipelineTab wiring are verified by typecheck /
// ui_runtime, not here.

function makeAtomsFrame(n: number): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(n));
  atoms.setColF("y", new Float64Array(n));
  atoms.setColF("z", new Float64Array(n));
  frame.insertBlock("atoms", atoms);
  return frame;
}

function makeMemoryDS(filename: string): MemoryDataSource {
  return new MemoryDataSource(makeAtomsFrame(1), {
    filename,
    sourceType: "file",
  });
}

function makeFileDS(filename: string): FileDataSource {
  const traj = new Trajectory([makeAtomsFrame(1)]);
  return new FileDataSource(traj, { filename, sourceType: "file" });
}

/** A minimal non-DataSource modifier for the dispatch-filter test. */
const nonDataSourceModifier = {
  id: "not-a-source",
  name: "Not A Source",
  enabled: true,
} as unknown as Modifier;

describe("selectEnabledDataSources (ac-001)", () => {
  it("ac-001: keeps enabled DataSourceModifiers mapped to {id, name}", () => {
    const memory = makeMemoryDS("memory.xyz");
    const file = makeFileDS("file.pdb");
    const result = selectEnabledDataSources([memory, file]);
    expect(result).toEqual([
      { id: memory.id, name: memory.name },
      { id: file.id, name: file.name },
    ]);
  });

  it("ac-001: excludes disabled DataSourceModifiers", () => {
    const enabled = makeMemoryDS("a.xyz");
    const disabled = makeFileDS("b.pdb");
    disabled.enabled = false;
    expect(selectEnabledDataSources([enabled, disabled])).toEqual([
      { id: enabled.id, name: enabled.name },
    ]);
  });

  it("ac-001: excludes non-DataSource modifiers", () => {
    const ds = makeMemoryDS("a.xyz");
    expect(selectEnabledDataSources([nonDataSourceModifier, ds])).toEqual([
      { id: ds.id, name: ds.name },
    ]);
  });
});

describe("selectEnabledDataSources empty results (ac-002)", () => {
  it("ac-002: returns [] for an empty list", () => {
    expect(selectEnabledDataSources([])).toEqual([]);
  });

  it("ac-002: returns [] when every DataSource is disabled", () => {
    const a = makeMemoryDS("a.xyz");
    const b = makeFileDS("b.pdb");
    a.enabled = false;
    b.enabled = false;
    expect(selectEnabledDataSources([a, b])).toEqual([]);
  });

  it("ac-002: returns [] when no DataSourceModifier is present", () => {
    expect(selectEnabledDataSources([nonDataSourceModifier])).toEqual([]);
  });
});

describe("formatRmsd (ac-003)", () => {
  it("ac-003: formats a finite value to 3 decimals with Å", () => {
    expect(formatRmsd(1.2345)).toBe("1.234 Å");
  });

  it("ac-003: renders zero as 0.000 Å", () => {
    expect(formatRmsd(0)).toBe("0.000 Å");
  });

  it("ac-003: renders null as an em dash", () => {
    expect(formatRmsd(null)).toBe("—");
  });

  it("ac-003: renders non-finite NaN as an em dash", () => {
    expect(formatRmsd(Number.NaN)).toBe("—");
  });
});

describe("buildSourceLegend (ac-004)", () => {
  it("ac-004: returns [] for empty input", () => {
    expect(buildSourceLegend([])).toEqual([]);
  });

  it("ac-004: one entry per id, label === id, hex-format color", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    expect(legend).toHaveLength(3);
    expect(legend.map((entry) => entry.label)).toEqual(["x", "y", "z"]);
    for (const entry of legend) {
      expect(entry.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("ac-004: assigns distinct colors to distinct ordinals", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    const colors = legend.map((entry) => entry.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("ac-004: colors match the core categorical palette ordinals", () => {
    const legend = buildSourceLegend(["x", "y", "z"]);
    const coreHexes = buildSourceColorLegend([0, 1, 2]).map(
      (entry) => entry.hex,
    );
    expect(legend.map((entry) => entry.color)).toEqual(coreHexes);
  });

  it("ac-004: wraps colors past the categorical palette length", () => {
    const paletteLength = getCategoricalPalette().length;
    const ids = Array.from({ length: paletteLength + 1 }, (_, i) => `id-${i}`);
    const legend = buildSourceLegend(ids);
    expect(legend).toHaveLength(paletteLength + 1);
    expect(legend[paletteLength].color).toBe(legend[0].color);
  });
});
