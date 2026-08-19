import * as assert from "assert";
import { WebviewHostRangeSource } from "../../../src/webview/hostRangeSource";

suite("hostRangeSource", () => {
  test("kind is host and size is the declared byte length", async () => {
    const src = new WebviewHostRangeSource(
      "file:///tmp/a.dump",
      4096,
      () => {},
    );
    assert.strictEqual(src.kind, "host");
    assert.strictEqual(await src.size(), 4096);
  });

  test("multiplexes fetchIds and ignores late bytes", async () => {
    const posts: Array<{ fetchId: number }> = [];
    const src = new WebviewHostRangeSource("file:///tmp/a.dump", 16, (msg) => {
      if (msg.type === "readRange") posts.push({ fetchId: msg.fetchId });
    });
    const a = src.readRange(0, 4);
    const b = src.readRange(4, 8);
    assert.deepStrictEqual(
      posts.map((p) => p.fetchId),
      [1, 2],
    );
    src.deliver(2, new Uint8Array([4, 5, 6, 7]));
    src.deliver(99, new Uint8Array([9]));
    src.deliver(1, new Uint8Array([0, 1, 2, 3]));
    assert.deepStrictEqual([...(await a)], [0, 1, 2, 3]);
    assert.deepStrictEqual([...(await b)], [4, 5, 6, 7]);
  });
});
