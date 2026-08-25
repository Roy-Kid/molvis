import { DCDReader } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../../setup_wasm";
import { buildMultiDcd, DCD_NSET_OFFSET } from "../../fixtures/dcd";

describe("eager DCDReader", () => {
  it("counts every frame even when the DCD NSET header says 1", () => {
    // A run that appends frames without rewriting its header leaves NSET
    // stale. molvis trusts `DCDReader.len()` for the eager (non-streaming)
    // load path, so that count has to come from scanning, not from NSET.
    const bytes = buildMultiDcd([0, 1, 2], { patchNset: false });
    const nset = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getInt32(DCD_NSET_OFFSET, true);
    expect(nset).toBe(1);

    const reader = new DCDReader(bytes);
    expect(reader.len()).toBe(3);
    reader.free();
  });

  it("reads every frame of a multi-frame DCD", () => {
    const bytes = buildMultiDcd([0, 1, 2]);
    const reader = new DCDReader(bytes);
    expect(reader.len()).toBe(3);

    for (let i = 0; i < reader.len(); i++) {
      const x = reader.read(i)?.getBlock("atoms")?.viewColF("x");
      expect(x?.[0]).toBeCloseTo(i, 5);
    }
    reader.free();
  });
});
