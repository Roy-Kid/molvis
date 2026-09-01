import * as assert from "assert";
import {
  collapseMrecStoreUri,
  getDisplayName,
  isMrecUriPath,
  mrecStoreRootPath,
} from "../../../src/extension/loading/pathUtils";

suite("pathUtils", () => {
  test("getDisplayName returns basename", () => {
    const uri = { fsPath: "/tmp/a/b/frame.xyz" } as never;
    assert.strictEqual(getDisplayName(uri), "frame.xyz");
  });

  test("mrecStoreRootPath accepts the store and any path inside it", () => {
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/zarr.json"),
      "/tmp/data/root.mrec",
    );
    assert.strictEqual(
      mrecStoreRootPath("/tmp/data/root.mrec/trajectory/atoms/x/c/0"),
      "/tmp/data/root.mrec",
    );
  });

  test("mrecStoreRootPath rejects packed zip and non-mrec paths", () => {
    assert.strictEqual(mrecStoreRootPath("/tmp/data/root.mrec.zip"), undefined);
    assert.strictEqual(mrecStoreRootPath("/tmp/data/root.zarr"), undefined);
    assert.strictEqual(mrecStoreRootPath("/tmp/data/frame.xyz"), undefined);
  });

  test("collapseMrecStoreUri rewrites nested keys to the store root", () => {
    const nested = {
      path: "/tmp/data/root.mrec/zarr.json",
      with(change: { path: string }) {
        return { path: change.path };
      },
    };
    const collapsed = collapseMrecStoreUri(nested as never);
    assert.strictEqual(collapsed.path, "/tmp/data/root.mrec");
  });

  test("isMrecUriPath matches directory mrec path", () => {
    const uri = { path: "/tmp/data/root.mrec" } as never;
    assert.strictEqual(isMrecUriPath(uri, 2), true);
  });

  test("isMrecUriPath matches trailing-slash mrec directory", () => {
    const uri = { path: "/tmp/data/root.mrec/" } as never;
    assert.strictEqual(isMrecUriPath(uri, 2), true);
  });

  test("isMrecUriPath rejects files and non-mrec directories", () => {
    const fileUri = { path: "/tmp/data/root.mrec" } as never;
    const dirUri = { path: "/tmp/data/root.xyz" } as never;
    const zarrUri = { path: "/tmp/data/root.zarr" } as never;

    assert.strictEqual(isMrecUriPath(fileUri, 1), false);
    assert.strictEqual(isMrecUriPath(dirUri, 2), false);
    assert.strictEqual(isMrecUriPath(zarrUri, 2), false);
  });
});
