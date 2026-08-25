/**
 * color_hex tests — linear RGB ↔ the browser color input's `#rrggbb`.
 */

import { describe, expect, it } from "@rstest/core";
import {
  hexToRgb,
  rgbToHex,
} from "../../../../../src/ui/modes/view/modifiers/color_hex";

const BLUE = [0.4, 0.65, 1.0] as const;

describe("TestColorHex", () => {
  it("round-trips a color through hex within one 8-bit step", () => {
    const round = hexToRgb(rgbToHex(BLUE), [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(round[i] - BLUE[i])).toBeLessThan(1 / 255);
    }
  });

  it("clamps out-of-range channels instead of wrapping", () => {
    expect(rgbToHex([-1, 0.5, 2])).toBe("#0080ff");
  });

  it("pads single-digit channels", () => {
    expect(rgbToHex([0, 0, 1 / 255])).toBe("#000001");
  });

  it("accepts hex with or without the hash, in either case", () => {
    expect(hexToRgb("#FF0000", BLUE)).toEqual([1, 0, 0]);
    expect(hexToRgb("ff0000", BLUE)).toEqual([1, 0, 0]);
    expect(hexToRgb("  #ff0000  ", BLUE)).toEqual([1, 0, 0]);
  });

  it("returns the caller's fallback for unparseable input", () => {
    // The fallback is a parameter precisely so each panel keeps its own,
    // rather than inheriting whichever constant its copy happened to have.
    expect(hexToRgb("not a color", BLUE)).toEqual([0.4, 0.65, 1.0]);
    expect(hexToRgb("#ff00", [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5]);
  });

  it("does not hand back the caller's fallback array to mutate", () => {
    const fallback: [number, number, number] = [0.5, 0.5, 0.5];
    const result = hexToRgb("bad", fallback);
    result[0] = 1;
    expect(fallback[0]).toBe(0.5);
  });
});
