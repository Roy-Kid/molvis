import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as assert from "assert";
import { FileRangeReader } from "../../../src/extension/loading/fileRangeReader";

suite("fileRangeReader", () => {
  test("reads a half-open byte range", async () => {
    const dir = await mkdtemp(join(tmpdir(), "molvis-range-"));
    const path = join(dir, "sample.bin");
    await writeFile(path, "abcdefghij");
    const reader = new FileRangeReader();
    const slice = await reader.read(path, 2, 6, 1);
    assert.strictEqual(Buffer.from(slice).toString("utf8"), "cdef");
    assert.strictEqual(Object.getPrototypeOf(slice), Uint8Array.prototype);
    assert.strictEqual(slice.byteOffset, 0);
    assert.strictEqual(slice.buffer.byteLength, slice.byteLength);
  });

  test("cancel rejects an in-flight read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "molvis-range-"));
    const path = join(dir, "sample.bin");
    await writeFile(path, "abcdefghij");
    const reader = new FileRangeReader();
    const pending = reader.read(path, 0, 10, 7);
    reader.cancel(7);
    await assert.rejects(pending, /cancelled/);
  });
});
