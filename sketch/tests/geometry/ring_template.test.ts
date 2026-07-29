import { describe, expect, it } from "@rstest/core";
import { buildRingTemplate } from "../../src/geometry/ring_template";

describe("buildRingTemplate", () => {
  it("size 6 has 6 vertices and edges; radius ~1 from center", () => {
    const r = buildRingTemplate(6, 0, 0, 1);
    expect(r.vertices).toHaveLength(6);
    expect(r.edges).toHaveLength(6);
    for (const v of r.vertices) {
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 8);
    }
  });

  it("benzene shares topology with aliphatic 6", () => {
    const b = buildRingTemplate(6, 0, 0, 1, "benzene");
    expect(b.kind).toBe("benzene");
    expect(b.vertices).toHaveLength(6);
  });

  it("rejects size outside 3..8", () => {
    expect(() => buildRingTemplate(2, 0, 0)).toThrow();
  });
});
