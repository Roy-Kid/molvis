import { describe, expect, it } from "@rstest/core";
import { TrajectoryExtent } from "../../src/lib/trajectory-extent";

describe("TrajectoryExtent", () => {
  it("readout and last index for a complete 40-frame traj at frame 2", () => {
    const ext = new TrajectoryExtent({
      length: 40,
      indexedLength: 40,
      indexComplete: true,
    });
    expect(ext.addressableLength).toBe(40);
    expect(ext.lastAddressableIndex).toBe(39);
    expect(ext.frameReadout(2)).toBe("3/40");
    expect(ext.allowsImplicitWholeRange).toBe(true);
    expect(ext.implicitEndIndex()).toBe(39);
    expect(ext.lastControlLabel).toBe("Last frame");
  });

  it("scanning 12 indexed frames reports ellipsis and blocks implicit end", () => {
    const ext = new TrajectoryExtent({
      length: null,
      indexedLength: 12,
      indexComplete: false,
    });
    expect(ext.addressableLength).toBe(12);
    expect(ext.lastAddressableIndex).toBe(11);
    expect(ext.frameReadout(2)).toBe("3/12…");
    expect(ext.allowsImplicitWholeRange).toBe(false);
    expect(ext.implicitEndIndex()).toBeNull();
    expect(ext.lastControlLabel).toBe("Last indexed frame");
    expect(ext.filmstripVisible).toBe(true);
  });
});
