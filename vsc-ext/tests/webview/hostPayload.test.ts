import * as assert from "assert";
import { hostPayload } from "../../src/webview/hostPayload";

const encode = (text: string) => new TextEncoder().encode(text);

suite("webview/hostPayload", () => {
  test("decodes text-format bytes so the host never ships a whole-file string", () => {
    const out = hostPayload(encode("LAMMPS data\n\n2 atoms\n"), true);
    assert.strictEqual(out, "LAMMPS data\n\n2 atoms\n");
  });

  test("decodes a Buffer-JSON shape the same way", () => {
    const bytes = [...encode("ATOM")];
    const out = hostPayload(
      { type: "Buffer", data: bytes } as unknown as Uint8Array,
      true,
    );
    assert.strictEqual(out, "ATOM");
  });

  test("keeps binary-format bytes as bytes", () => {
    const bytes = encode("CORD");
    const out = hostPayload(bytes, false);
    assert.strictEqual(out, bytes);
  });

  test("keeps an already-decoded string as it is", () => {
    assert.strictEqual(hostPayload("1\n\nH 0 0 0\n", true), "1\n\nH 0 0 0\n");
  });

  test("passes an mrec store record through the store normalizer", () => {
    const out = hostPayload({ "c/0": new Uint8Array([1, 2]) }, false) as Record<
      string,
      Uint8Array
    >;
    assert.deepStrictEqual([...out["c/0"]], [1, 2]);
  });

  test("keeps bytes when the format is not text", () => {
    const bytes = encode("unknown");
    assert.strictEqual(hostPayload(bytes, false), bytes);
  });
});
