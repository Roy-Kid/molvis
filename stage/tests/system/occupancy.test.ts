import { describe, expect, it } from "@rstest/core";
import { occupiedAtomCount } from "../../src/system/occupancy";

describe("occupiedAtomCount", () => {
  it("counts non-sentinel rows when a pile sits at the origin", () => {
    const x = new Float64Array([1.4, 2.8, 0, 0, 0, 0]);
    const y = new Float64Array(6);
    const z = new Float64Array(6);
    expect(occupiedAtomCount(x, y, z, 6)).toBe(2);
  });

  it("keeps a single origin atom as real occupancy", () => {
    const x = new Float64Array([0, 1.4]);
    const y = new Float64Array(2);
    const z = new Float64Array(2);
    expect(occupiedAtomCount(x, y, z, 2)).toBe(2);
  });
});
