import * as assert from "assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RemoteMolrsIndexer } from "../../../src/extension/loading/remoteMolrsIndexer";

suite("remoteMolrsIndexer", () => {
  test("returns null for a structure format", async () => {
    const indexer = new RemoteMolrsIndexer(
      async () => new Uint8Array(),
      () => {
        throw new Error("stream must not be constructed for structures");
      },
      () => {},
    );
    assert.strictEqual(await indexer.index("lammps", 1024), null);
  });

  test("feeds the injected molrs stream and records chunks", async () => {
    const feeds: Array<{ offset: number; len: number }> = [];
    const bytes = new Uint8Array(32);
    const indexer = new RemoteMolrsIndexer(
      async (start, end) => bytes.subarray(start, end),
      () => ({
        hintTotalBytes() {},
        allocInputBuffer(len) {
          return len;
        },
        feedIndexChunk(offset, len) {
          feeds.push({ offset, len });
          return [{ byteOffset: offset, byteLen: len }];
        },
        finishIndex() {
          return [];
        },
      }),
      () => {},
    );
    const entries = await indexer.index("xyz", 32);
    assert.ok(entries);
    assert.ok(feeds.length >= 1);
    assert.strictEqual(feeds[0].offset, 0);
  });

  test("source file does not scan ITEM: TIMESTEP", () => {
    const here = dirname(__filename);
    const src = readFileSync(
      join(here, "../../../src/extension/loading/remoteMolrsIndexer.ts"),
      "utf8",
    );
    assert.ok(!src.includes("ITEM: TIMESTEP"));
  });
});
