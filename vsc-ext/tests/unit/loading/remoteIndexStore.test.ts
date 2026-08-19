import * as assert from "assert";
import { RemoteIndexStore } from "../../../src/extension/loading/remoteIndexStore";

suite("remoteIndexStore", () => {
  test("writes sibling first", async () => {
    const written = new Map<string, Uint8Array>();
    const store = new RemoteIndexStore(
      {
        async readFile(uri) {
          const v = written.get(uri);
          if (!v) throw new Error("miss");
          return v;
        },
        async writeFile(uri, data) {
          written.set(uri, data);
        },
      },
      "file:///cache",
    );
    const placement = await store.save("file:///data/traj.xyz", "traj.xyz", {
      format: "xyz",
      fileSize: 16,
      entries: [{ byteOffset: 0, byteLen: 16 }],
    });
    assert.strictEqual(placement, "sibling");
    assert.ok(written.has("file:///data/traj.xyz.molidx"));
  });

  test("falls back to cache when sibling write fails", async () => {
    const written = new Map<string, Uint8Array>();
    const store = new RemoteIndexStore(
      {
        async readFile() {
          throw new Error("miss");
        },
        async writeFile(uri, data) {
          if (uri.endsWith("traj.xyz.molidx") && !uri.includes("/cache/")) {
            throw new Error("sibling denied");
          }
          written.set(uri, data);
        },
      },
      "file:///cache",
    );
    const placement = await store.save("file:///ro/traj.xyz", "traj.xyz", {
      format: "xyz",
      fileSize: 8,
      entries: [{ byteOffset: 0, byteLen: 8 }],
    });
    assert.strictEqual(placement, "cache");
    assert.ok(written.has("file:///cache/traj.xyz.molidx"));
  });

  test("returns none when both writes fail", async () => {
    const store = new RemoteIndexStore(
      {
        async readFile() {
          throw new Error("miss");
        },
        async writeFile() {
          throw new Error("denied");
        },
      },
      "file:///cache",
    );
    const placement = await store.save("file:///ro/traj.xyz", "traj.xyz", {
      format: "xyz",
      fileSize: 8,
      entries: [{ byteOffset: 0, byteLen: 8 }],
    });
    assert.strictEqual(placement, "none");
  });
});
