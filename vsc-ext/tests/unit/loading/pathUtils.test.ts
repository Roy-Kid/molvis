import * as assert from "assert";
import {
  getDisplayName,
  isZarrUriPath,
} from "../../../src/extension/loading/pathUtils";

suite("pathUtils", () => {
  test("getDisplayName returns basename", () => {
    const uri = { fsPath: "/tmp/a/b/frame.xyz" } as never;
    assert.strictEqual(getDisplayName(uri), "frame.xyz");
  });

  test("isZarrUriPath matches directory mrec path", () => {
    const uri = { path: "/tmp/data/root.mrec" } as never;
    assert.strictEqual(isZarrUriPath(uri, 2), true);
  });

  test("isZarrUriPath matches trailing-slash mrec directory", () => {
    const uri = { path: "/tmp/data/root.mrec/" } as never;
    assert.strictEqual(isZarrUriPath(uri, 2), true);
  });

  test("isZarrUriPath rejects files and non-mrec directories", () => {
    const fileUri = { path: "/tmp/data/root.mrec" } as never;
    const dirUri = { path: "/tmp/data/root.xyz" } as never;
    const zarrUri = { path: "/tmp/data/root.zarr" } as never;

    assert.strictEqual(isZarrUriPath(fileUri, 1), false);
    assert.strictEqual(isZarrUriPath(dirUri, 2), false);
    assert.strictEqual(isZarrUriPath(zarrUri, 2), false);
  });
});
