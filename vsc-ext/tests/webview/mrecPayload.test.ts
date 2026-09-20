import * as assert from "assert";
import { normalizeMrecPayload } from "../../src/webview/mrecPayload";

suite("webview/mrecPayload", () => {
  test("keeps packed Uint8Array values and base64 strings as they are", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const out = normalizeMrecPayload({ "c/0": bytes, "zarr.json": "e30=" });
    assert.strictEqual(out["c/0"], bytes);
    assert.strictEqual(out["zarr.json"], "e30=");
  });

  test("coerces ArrayBuffer and Buffer-JSON shapes to Uint8Array", () => {
    const out = normalizeMrecPayload({
      raw: new Uint8Array([4, 5]).buffer,
      json: { type: "Buffer", data: [6, 7] },
    });
    assert.deepStrictEqual([...(out.raw as Uint8Array)], [4, 5]);
    assert.deepStrictEqual([...(out.json as Uint8Array)], [6, 7]);
  });

  test("rejects a value that is neither text nor bytes", () => {
    assert.throws(
      () => normalizeMrecPayload({ bad: 42 }),
      /entry "bad" was not binary/,
    );
  });
});
