import { WasmDcdStream } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../../setup_wasm";
import {
  buildMultiDcd,
  indexFrames,
  writeInto,
  xCol,
} from "../../fixtures/dcd";

describe("dcd hit-path (no decoder context)", () => {
  it("decodes every frame range without setDecoderContext", () => {
    const seeds = [0, 1, 2];
    const bytes = buildMultiDcd(seeds);
    const { entries } = indexFrames(bytes);
    expect(entries.length).toBe(seeds.length);

    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i];
      const range = bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen);
      const parseStream = new WasmDcdStream();
      // Deliberately NO setDecoderContext — this mirrors the `.molidx` cache
      // hit path, where the index came off disk and no indexing stream ran
      // in this session to hand us a context.
      writeInto(parseStream, range);
      parseStream.parseRangeInInput(0, range.byteLength);
      expect(xCol(parseStream)?.[0]).toBeCloseTo(seeds[i], 5);
    }
  });
});
