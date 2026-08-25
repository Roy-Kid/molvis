import { WasmDcdStream } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import "../../setup_wasm";
import {
  buildMultiDcd,
  indexFrames,
  writeInto,
  xCol,
} from "../../fixtures/dcd";

describe("multi-frame dcd", () => {
  it("indexes and decodes every frame from the indexer's frame ranges", () => {
    const seeds = [0, 1, 2];
    const bytes = buildMultiDcd(seeds);
    const { stream: indexStream, entries } = indexFrames(bytes);
    expect(entries.length).toBe(seeds.length);

    const ctx = indexStream.decoderContext();

    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i];
      const range = bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen);
      const parseStream = new WasmDcdStream();
      if (ctx && ctx.length > 0) parseStream.setDecoderContext(ctx);
      writeInto(parseStream, range);
      parseStream.parseRangeInInput(0, range.byteLength);
      expect(xCol(parseStream)?.[0]).toBeCloseTo(seeds[i], 5);
    }
  });

  it("reuses one parseStream across frames like the trajectory worker", () => {
    const seeds = [0, 1, 2];
    const bytes = buildMultiDcd(seeds);
    const { stream: indexStream, entries } = indexFrames(bytes);
    expect(entries.length).toBe(seeds.length);

    const parseStream = new WasmDcdStream();
    const ctx = indexStream.decoderContext();
    if (ctx && ctx.length > 0) parseStream.setDecoderContext(ctx);

    for (let i = 0; i < entries.length; i++) {
      const pos = entries[i];
      const range = bytes.slice(pos.byteOffset, pos.byteOffset + pos.byteLen);
      writeInto(parseStream, range);
      parseStream.parseRangeInInput(0, range.byteLength);
      expect(parseStream.blockCount()).toBeGreaterThan(0);
      expect(xCol(parseStream)?.[0]).toBeCloseTo(seeds[i], 5);
      parseStream.releaseFrame();
    }
  });
});
