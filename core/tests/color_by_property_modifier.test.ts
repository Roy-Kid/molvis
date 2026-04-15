import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { DEFAULT_CATEGORICAL_COLOR_MAP } from "../src/artist/palette";
import {
  COLOR_OVERRIDE_B,
  COLOR_OVERRIDE_G,
  COLOR_OVERRIDE_R,
  ColorByPropertyModifier,
} from "../src/modifiers/ColorByPropertyModifier";
import { createDefaultContext } from "../src/pipeline/types";

function makeFrame(types: string[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF("x", new Float64Array(types.length));
  atoms.setColF("y", new Float64Array(types.length));
  atoms.setColF("z", new Float64Array(types.length));
  atoms.setColStr("type", types);
  frame.insertBlock("atoms", atoms);
  return frame;
}

function extractTypeColors(
  frame: Frame,
): Map<string, [number, number, number]> {
  const atoms = frame.getBlock("atoms")!;
  const types = atoms.copyColStr("type")!;
  const r = atoms.viewColF(COLOR_OVERRIDE_R)!;
  const g = atoms.viewColF(COLOR_OVERRIDE_G)!;
  const b = atoms.viewColF(COLOR_OVERRIDE_B)!;
  const colors = new Map<string, [number, number, number]>();

  for (let i = 0; i < types.length; i++) {
    colors.set(types[i], [r[i], g[i], b[i]]);
  }
  return colors;
}

function colorDistance(
  a: [number, number, number],
  b: [number, number, number],
) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

describe("ColorByPropertyModifier", () => {
  it("uses dataset-level categorical colors for string columns", () => {
    const mod = new ColorByPropertyModifier();
    mod.columnName = "type";
    mod.colormap = "viridis";

    const frameA = makeFrame(["opls_146", "opls_145", "opls_147"]);
    const frameB = makeFrame(["opls_147", "opls_145", "opls_146"]);

    const resultA = mod.apply(frameA, createDefaultContext(frameA));
    const resultB = mod.apply(frameB, createDefaultContext(frameB));

    const colorsA = extractTypeColors(resultA);
    const colorsB = extractTypeColors(resultB);

    expect(colorsA.get("opls_145")).toEqual(colorsB.get("opls_145"));
    expect(colorsA.get("opls_146")).toEqual(colorsB.get("opls_146"));
    expect(colorsA.get("opls_147")).toEqual(colorsB.get("opls_147"));
  });

  it("ignores continuous colormap names for string columns", () => {
    const frame = makeFrame(["opls_145", "opls_146"]);

    const viridis = new ColorByPropertyModifier();
    viridis.columnName = "type";
    viridis.colormap = "viridis";

    const categorical = new ColorByPropertyModifier();
    categorical.columnName = "type";
    categorical.colormap = DEFAULT_CATEGORICAL_COLOR_MAP;

    const viridisResult = viridis.apply(frame, createDefaultContext(frame));
    const categoricalResult = categorical.apply(
      frame,
      createDefaultContext(frame),
    );

    expect(extractTypeColors(viridisResult)).toEqual(
      extractTypeColors(categoricalResult),
    );
  });

  it("assigns clearly different colors to neighboring opls types", () => {
    const mod = new ColorByPropertyModifier();
    mod.columnName = "type";
    mod.colormap = "viridis";

    const frame = makeFrame(["opls_145", "opls_146", "opls_147"]);
    const result = mod.apply(frame, createDefaultContext(frame));
    const colors = extractTypeColors(result);

    const diff145_146 = colorDistance(
      colors.get("opls_145")!,
      colors.get("opls_146")!,
    );
    const diff146_147 = colorDistance(
      colors.get("opls_146")!,
      colors.get("opls_147")!,
    );

    expect(diff145_146).toBeGreaterThan(0.1);
    expect(diff146_147).toBeGreaterThan(0.1);
  });
});
