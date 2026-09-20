import type { TrajectoryRuntime } from "@molcrafts/molvis-stage/trajectory-runtime";
import { describe, expect, it } from "@rstest/core";
import {
  mrecSourceHandleFor,
  openMrecTrajectory,
} from "../../src/io/mrec_stream";

const bytes = (...v: number[]) => new Uint8Array(v);

describe("mrecSourceHandleFor", () => {
  it("files: one packed transferable buffer per key", async () => {
    const shared = new Uint8Array([1, 2, 3, 4]);
    const handle = await mrecSourceHandleFor({
      kind: "files",
      files: new Map([
        ["a", bytes(9)],
        ["b", shared.subarray(1, 3)],
      ]),
    });
    if (handle.kind !== "mrec-files") throw new Error("wrong kind");
    expect([...new Uint8Array(handle.files.get("a")!)]).toEqual([9]);
    // A view onto a larger buffer must be copied out, never leak the slab.
    expect([...new Uint8Array(handle.files.get("b")!)]).toEqual([2, 3]);
    expect(handle.files.get("b")!.byteLength).toBe(2);
  });

  it("file-tree: the File handles themselves, copied into a fresh map", async () => {
    const file = new File([bytes(1) as BlobPart], "0");
    const source = new Map([["c/0", file]]);
    const handle = await mrecSourceHandleFor({
      kind: "file-tree",
      files: source,
    });
    if (handle.kind !== "mrec-file-tree") throw new Error("wrong kind");
    expect(handle.files.get("c/0")).toBe(file);
    expect(handle.files).not.toBe(source);
  });

  it("zip: the whole archive as one buffer", async () => {
    const handle = await mrecSourceHandleFor({
      kind: "zip",
      blob: new Blob([bytes(5, 6) as BlobPart]),
    });
    if (handle.kind !== "mrec-zip") throw new Error("wrong kind");
    expect([...new Uint8Array(handle.bytes)]).toEqual([5, 6]);
  });
});

describe("openMrecTrajectory", () => {
  function fakeRuntime(frameCount: number, failOpen = false) {
    const log: string[] = [];
    const runtime = {
      openStore: async (source: { kind: string }) => {
        log.push(`open:${source.kind}`);
        if (failOpen) throw new Error("bad store");
        return {
          frameCount,
          indexedLength: frameCount,
          length: frameCount,
          indexComplete: true,
          totalBytes: 0,
        };
      },
      loadFrameLatest: async (index: number) => {
        log.push(`load:${index}`);
        return { tag: index } as never;
      },
      sectionUpdates: (index: number) =>
        index === 1 ? new Map([["atoms", 7]]) : undefined,
      close: async () => {
        log.push("close");
      },
    };
    return { runtime: runtime as unknown as TrajectoryRuntime, log };
  }

  it("wraps the opened runtime as an async trajectory with the seam", async () => {
    const { runtime, log } = fakeRuntime(3);
    const { trajectory, dispose } = await openMrecTrajectory(runtime, {
      kind: "files",
      files: new Map([["zarr.json", bytes(1)]]),
    });
    expect(trajectory.length).toBe(3);
    expect(trajectory.isLazy).toBe(true);
    expect(trajectory.sectionUpdates(1)?.get("atoms")).toBe(7);
    expect(trajectory.sectionUpdates(0)).toBeUndefined();
    await trajectory.frame(2);
    expect(log).toEqual(["open:mrec-files", "load:2"]);
    dispose();
    expect(log.at(-1)).toBe("close");
  });

  it("closes the runtime and rethrows when the open fails", async () => {
    const { runtime, log } = fakeRuntime(0, true);
    await expect(
      openMrecTrajectory(runtime, {
        kind: "zip",
        blob: new Blob([bytes(1) as BlobPart]),
      }),
    ).rejects.toThrow("bad store");
    expect(log).toEqual(["open:mrec-zip", "close"]);
  });
});
