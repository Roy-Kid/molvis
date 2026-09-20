import * as assert from "assert";
import {
  FILE_TYPE_DIRECTORY,
  FILE_TYPE_FILE,
  packedBytes,
  readZarrDirectoryWithFs,
} from "../../src/extension/loading/zarrDirectoryReaderCore";

interface MockUri {
  path: string;
}

suite("zarrDirectoryReaderCore", () => {
  test("reads nested tree and returns a bytes map with relative keys", async () => {
    const fs = {
      readDirectory: async (uri: MockUri): Promise<Array<[string, number]>> => {
        if (uri.path.endsWith("/root.zarr")) {
          return [
            ["group", FILE_TYPE_DIRECTORY],
            [".zgroup", FILE_TYPE_FILE],
          ];
        }
        if (uri.path.endsWith("/root.zarr/group")) {
          return [
            ["array", FILE_TYPE_DIRECTORY],
            [".zattrs", FILE_TYPE_FILE],
          ];
        }
        if (uri.path.endsWith("/root.zarr/group/array")) {
          return [
            ["0.0", FILE_TYPE_FILE],
            ["0.1", FILE_TYPE_FILE],
          ];
        }
        return [];
      },
      readFile: async (uri: MockUri): Promise<Uint8Array> => {
        const name = uri.path.split("/").pop() || "unknown";
        return Buffer.from(`content of ${name}`);
      },
    };

    const uriHelpers = {
      joinPath: (base: MockUri, ...pathSegments: string[]): MockUri => ({
        path: `${base.path}/${pathSegments.join("/")}`,
      }),
    };

    const uri = { path: "/tmp/root.zarr" };
    const files = await readZarrDirectoryWithFs(uri, fs, uriHelpers);

    assert.deepStrictEqual(Object.keys(files).sort(), [
      ".zgroup",
      "group/.zattrs",
      "group/array/0.0",
      "group/array/0.1",
    ]);

    for (const key of Object.keys(files)) {
      assert.ok(!key.startsWith("/"), `Unexpected absolute key: ${key}`);
    }

    const chunk = files["group/array/0.0"];
    assert.ok(chunk instanceof Uint8Array);
    assert.strictEqual(Buffer.from(chunk).toString("utf8"), "content of 0.0");
  });

  test("packs pooled views so the payload carries only the file's bytes", async () => {
    const slab = new Uint8Array(64).fill(9);
    const pooled = slab.subarray(8, 12);
    const fs = {
      readDirectory: async (): Promise<Array<[string, number]>> => [
        ["zarr.json", FILE_TYPE_FILE],
      ],
      readFile: async (): Promise<Uint8Array> => pooled,
    };
    const uriHelpers = {
      joinPath: (base: MockUri, ...segments: string[]): MockUri => ({
        path: `${base.path}/${segments.join("/")}`,
      }),
    };

    const files = await readZarrDirectoryWithFs(
      { path: "/tmp/root.zarr" },
      fs,
      uriHelpers,
    );

    const bytes = files["zarr.json"];
    assert.strictEqual(bytes.byteOffset, 0);
    assert.strictEqual(bytes.buffer.byteLength, 4);
    assert.deepStrictEqual([...bytes], [9, 9, 9, 9]);
    assert.strictEqual(packedBytes(bytes), bytes);
  });

  test("refuses a store past the byte cap", async () => {
    const fs = {
      readDirectory: async (): Promise<Array<[string, number]>> => [
        ["a", FILE_TYPE_FILE],
        ["b", FILE_TYPE_FILE],
      ],
      readFile: async (): Promise<Uint8Array> => new Uint8Array(600),
    };
    const uriHelpers = {
      joinPath: (base: MockUri, ...segments: string[]): MockUri => ({
        path: `${base.path}/${segments.join("/")}`,
      }),
    };
    await assert.rejects(
      readZarrDirectoryWithFs({ path: "/tmp/root.zarr" }, fs, uriHelpers, {
        maxTotalBytes: 1000,
      }),
      /refusing to read the whole store/,
    );
  });
});
