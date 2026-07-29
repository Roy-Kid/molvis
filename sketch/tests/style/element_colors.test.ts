import { describe, expect, it } from "@rstest/core";
import {
  colorForElement,
  SKETCH_ELEMENT_COLORS,
} from "../../src/style/element_colors";

describe("SKETCH_ELEMENT_COLORS", () => {
  it("returns hard-coded CPK hex for H C N O F P S Cl Br I", () => {
    expect(SKETCH_ELEMENT_COLORS.H).toBe("#FFFFFF");
    expect(SKETCH_ELEMENT_COLORS.C).toBe("#C8CDD6");
    expect(SKETCH_ELEMENT_COLORS.N).toBe("#3050F8");
    expect(SKETCH_ELEMENT_COLORS.O).toBe("#FF0D0D");
    expect(SKETCH_ELEMENT_COLORS.F).toBe("#90E050");
    expect(SKETCH_ELEMENT_COLORS.P).toBe("#FF8000");
    expect(SKETCH_ELEMENT_COLORS.S).toBe("#FFFF30");
    expect(SKETCH_ELEMENT_COLORS.Cl).toBe("#1FF01F");
    expect(SKETCH_ELEMENT_COLORS.Br).toBe("#A62929");
    expect(SKETCH_ELEMENT_COLORS.I).toBe("#940094");
  });

  it("unknown element falls back to gray", () => {
    expect(colorForElement("Xx")).toBe("#808080");
  });
});
