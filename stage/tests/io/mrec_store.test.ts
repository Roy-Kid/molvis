import { describe, expect, it } from "@rstest/core";
import {
  type FileRangeReadSync,
  FileTreeMrecStoreHost,
  MapMrecStoreHost,
  sectionUpdatesAt,
} from "../../src/io/mrec_store";

const bytes = (...v: number[]) => new Uint8Array(v);

describe("MapMrecStoreHost", () => {
  const host = new MapMrecStoreHost(
    new Map([
      ["zarr.json", bytes(1, 2, 3)],
      ["trajectory/step/c/0", bytes(4, 5, 6, 7, 8)],
      ["trajectory/step/zarr.json", bytes(9)],
    ]),
  );

  it("serves whole values and sizes, null when absent", () => {
    expect([...(host.get("zarr.json") ?? [])]).toEqual([1, 2, 3]);
    expect(host.size("trajectory/step/c/0")).toBe(5);
    expect(host.get("missing")).toBeNull();
    expect(host.size("missing")).toBeNull();
  });

  it("getRange slices without copying and clamps at the end", () => {
    const whole = host.get("trajectory/step/c/0")!;
    const range = host.getRange("trajectory/step/c/0", 1, 2)!;
    expect([...range]).toEqual([5, 6]);
    expect(range.buffer).toBe(whole.buffer);
    expect([...host.getRange("trajectory/step/c/0", 3, -1)!]).toEqual([7, 8]);
    expect([...host.getRange("trajectory/step/c/0", 4, 10)!]).toEqual([8]);
    expect(host.getRange("missing", 0, 1)).toBeNull();
  });

  it("list returns full keys under a slash-terminated prefix", () => {
    expect(host.list("trajectory/step/").sort()).toEqual([
      "trajectory/step/c/0",
      "trajectory/step/zarr.json",
    ]);
    expect(host.list("").length).toBe(3);
    expect(host.list("nope/")).toEqual([]);
  });
});

describe("FileTreeMrecStoreHost", () => {
  function tree(): {
    host: FileTreeMrecStoreHost;
    reads: Array<[string, number, number]>;
  } {
    const contents = new Map<string, Uint8Array>([
      ["a/x", bytes(10, 11, 12, 13)],
      ["a/y", bytes(20)],
    ]);
    const files = new Map<string, File>();
    const byFile = new Map<File, string>();
    for (const [key, data] of contents) {
      const file = new File([data as BlobPart], key.split("/").pop() ?? key);
      files.set(key, file);
      byFile.set(file, key);
    }
    const reads: Array<[string, number, number]> = [];
    const readRange: FileRangeReadSync = (file, offset, length) => {
      const key = byFile.get(file);
      if (key === undefined) throw new Error("unknown file");
      reads.push([key, offset, length]);
      return contents.get(key)!.subarray(offset, offset + length);
    };
    return { host: new FileTreeMrecStoreHost(files, readRange), reads };
  }

  it("answers size and list from the handles without reading", () => {
    const { host, reads } = tree();
    expect(host.size("a/x")).toBe(4);
    expect(host.size("none")).toBeNull();
    expect(host.list("a/").sort()).toEqual(["a/x", "a/y"]);
    expect(reads).toEqual([]);
  });

  it("reads exactly the requested range; -1 means to the end", () => {
    const { host, reads } = tree();
    expect([...host.getRange("a/x", 1, 2)!]).toEqual([11, 12]);
    expect([...host.getRange("a/x", 2, -1)!]).toEqual([12, 13]);
    expect([...host.getRange("a/x", 3, 99)!]).toEqual([13]);
    expect(host.getRange("none", 0, 1)).toBeNull();
    expect(reads).toEqual([
      ["a/x", 1, 2],
      ["a/x", 2, 2],
      ["a/x", 3, 1],
    ]);
  });

  it("get reads the whole file", () => {
    const { host, reads } = tree();
    expect([...host.get("a/y")!]).toEqual([20]);
    expect(host.get("none")).toBeNull();
    expect(reads).toEqual([["a/y", 0, 1]]);
  });
});

describe("sectionUpdatesAt", () => {
  it("maps present blocks to their update id and drops absent ones", () => {
    const reader = {
      blockUpdateAt(name: string, t: number) {
        if (name === "atoms") return t;
        if (name === "bonds") return t >= 3 ? 0 : undefined;
        return undefined;
      },
    };
    expect([...sectionUpdatesAt(reader, ["atoms", "bonds"], 1)]).toEqual([
      ["atoms", 1],
    ]);
    expect([...sectionUpdatesAt(reader, ["atoms", "bonds"], 5)]).toEqual([
      ["atoms", 5],
      ["bonds", 0],
    ]);
  });
});
