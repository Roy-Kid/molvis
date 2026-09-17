import { describe, expect, it } from "@rstest/core";
import {
  collectMrecFilesFromEntry,
  collectMrecFilesFromHandle,
  type DirectoryEntryLike,
  type DirectoryHandleLike,
  type FileEntryLike,
  type FileHandleLike,
  isMrecDirectoryOpen,
  isMrecZipFile,
  mrecDirectoryFromRelativePaths,
  resolveDropTarget,
} from "../../src/lib/mrec-open";

function fileHandle(name: string, body = "x"): FileHandleLike {
  const file = new File([body], name);
  return { kind: "file", name, getFile: async () => file };
}

function dirHandle(
  name: string,
  children: Array<FileHandleLike | DirectoryHandleLike>,
): DirectoryHandleLike {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const child of children) yield [child.name, child];
    },
  };
}

function fileEntry(name: string): FileEntryLike {
  const file = new File(["y"], name);
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (ok) => ok(file),
  };
}

function dirEntry(
  name: string,
  children: Array<FileEntryLike | DirectoryEntryLike>,
): DirectoryEntryLike {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader() {
      // Serve in two batches then empty, like Chromium does.
      let served = 0;
      return {
        readEntries(ok) {
          const batch = children.slice(served, served + 1);
          served += batch.length;
          ok(batch);
        },
      };
    },
  };
}

describe("collectMrecFilesFromHandle", () => {
  it("walks nested handles into store-relative keys", async () => {
    const root = dirHandle("growth.mrec", [
      fileHandle("zarr.json"),
      dirHandle("trajectory", [
        fileHandle("zarr.json"),
        dirHandle("step", [dirHandle("c", [fileHandle("0")])]),
      ]),
    ]);
    const files = await collectMrecFilesFromHandle(root);
    expect([...files.keys()].sort()).toEqual([
      "trajectory/step/c/0",
      "trajectory/zarr.json",
      "zarr.json",
    ]);
    expect(files.get("zarr.json")).toBeInstanceOf(File);
  });
});

describe("collectMrecFilesFromEntry", () => {
  it("drains batched readEntries and keys files by path", async () => {
    const root = dirEntry("run.mrec", [
      fileEntry("zarr.json"),
      dirEntry("meta", [fileEntry("zarr.json")]),
      fileEntry("extra"),
    ]);
    const files = await collectMrecFilesFromEntry(root);
    expect([...files.keys()].sort()).toEqual([
      "extra",
      "meta/zarr.json",
      "zarr.json",
    ]);
  });
});

describe("mrecDirectoryFromRelativePaths", () => {
  function relFile(rel: string): File {
    const file = new File(["z"], rel.split("/").pop() ?? rel);
    Object.defineProperty(file, "webkitRelativePath", { value: rel });
    return file;
  }

  it("strips the picked directory and keeps the rest as the key", () => {
    const picked = mrecDirectoryFromRelativePaths([
      relFile("growth.mrec/zarr.json"),
      relFile("growth.mrec/trajectory/step/c/0"),
    ]);
    expect(picked?.name).toBe("growth.mrec");
    expect([...(picked?.files.keys() ?? [])].sort()).toEqual([
      "trajectory/step/c/0",
      "zarr.json",
    ]);
    expect(picked && isMrecDirectoryOpen(picked)).toBe(true);
  });

  it("is null without relative paths", () => {
    expect(mrecDirectoryFromRelativePaths([new File(["a"], "a.pdb")])).toBe(
      null,
    );
  });
});

describe("resolveDropTarget", () => {
  it("prefers a directory handle named *.mrec", async () => {
    const target = await resolveDropTarget(
      {
        kind: "file",
        getAsFileSystemHandle: async () =>
          dirHandle("growth.mrec", [fileHandle("zarr.json")]),
        getAsFile: () => null,
      },
      undefined,
    );
    expect(target && isMrecDirectoryOpen(target)).toBe(true);
    if (target && isMrecDirectoryOpen(target)) {
      expect(target.name).toBe("growth.mrec");
      expect(target.files.has("zarr.json")).toBe(true);
    }
  });

  it("refuses a dropped folder that is not a store", async () => {
    await expect(
      resolveDropTarget(
        {
          kind: "file",
          getAsFileSystemHandle: async () => dirHandle("photos", []),
          getAsFile: () => null,
        },
        undefined,
      ),
    ).rejects.toThrow(/only \*\.mrec store folders/);
  });

  it("falls back to the legacy entry API, then to the plain file", async () => {
    const viaEntry = await resolveDropTarget(
      {
        kind: "file",
        webkitGetAsEntry: () => dirEntry("run.mrec", [fileEntry("zarr.json")]),
        getAsFile: () => null,
      },
      undefined,
    );
    expect(viaEntry && isMrecDirectoryOpen(viaEntry)).toBe(true);

    const plain = new File(["p"], "a.pdb");
    const viaFile = await resolveDropTarget(
      { kind: "file", getAsFile: () => plain },
      undefined,
    );
    expect(viaFile).toBe(plain);
    expect(await resolveDropTarget(undefined, plain)).toBe(plain);
    expect(
      await resolveDropTarget(
        { kind: "string", getAsFile: () => null },
        undefined,
      ),
    ).toBeNull();
  });
});

describe("isMrecZipFile", () => {
  it("matches the packed store name", () => {
    expect(isMrecZipFile(new File([], "growth.mrec.zip"))).toBe(true);
    expect(isMrecZipFile(new File([], "growth.zip"))).toBe(false);
  });
});
