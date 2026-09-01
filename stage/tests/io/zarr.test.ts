import { TrajectoryReader } from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { viewAtomCoords } from "../../src/io/atom_coords";
import {
  collectMrecDirectory,
  loadMrecDirectory,
  loadMrecFiles,
  loadMrecStore,
  type MrecDirectorySource,
  type MrecDirent,
} from "../../src/io/zarr";
import { TINY_ZARR_FILES } from "./fixtures/tiny_zarr_files";
import "../setup_wasm";

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function memoryMrecSource(files: Record<string, string>): MrecDirectorySource {
  const bytes = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(files)) {
    bytes.set(path, decodeBase64(content));
  }

  return {
    list: async (path) => {
      const prefix = path ? `${path}/` : "";
      const names = new Map<string, MrecDirent["kind"]>();
      for (const key of bytes.keys()) {
        if (prefix) {
          if (key === path || !key.startsWith(prefix)) continue;
        }
        const rest = prefix ? key.slice(prefix.length) : key;
        const slash = rest.indexOf("/");
        const name = slash < 0 ? rest : rest.slice(0, slash);
        const kind: MrecDirent["kind"] = slash < 0 ? "file" : "directory";
        if (names.get(name) === "directory") continue;
        names.set(name, kind);
      }
      return [...names.entries()].map(([name, kind]) => ({ name, kind }));
    },
    read: async (path) => {
      const content = bytes.get(path);
      if (!content) throw new Error(`missing ${path}`);
      return content;
    },
  };
}

describe("collectMrecDirectory", () => {
  it("walks a directory source into store-relative keys", async () => {
    const source = memoryMrecSource({
      "zarr.json": btoa("root"),
      "trajectory/zarr.json": btoa("traj"),
      "trajectory/step/c/0": btoa("chunk"),
    });
    const files = await collectMrecDirectory(source);
    expect([...files.keys()].sort()).toEqual([
      "trajectory/step/c/0",
      "trajectory/zarr.json",
      "zarr.json",
    ]);
    expect(new TextDecoder().decode(files.get("zarr.json"))).toBe("root");
  });

  it("strips a nested root prefix from keys", async () => {
    const source = memoryMrecSource({
      "artifacts/pkg/zarr.json": btoa("root"),
      "artifacts/pkg/meta/zarr.json": btoa("meta"),
    });
    const files = await collectMrecDirectory(source, "artifacts/pkg");
    expect([...files.keys()].sort()).toEqual(["meta/zarr.json", "zarr.json"]);
  });

  it("refuses an empty store", async () => {
    const source = memoryMrecSource({});
    await expect(collectMrecDirectory(source)).rejects.toThrow(
      "mrec store is empty",
    );
  });
});

describe("loadMrecStore", () => {
  it("constructs TrajectoryReader (not RecordReader)", () => {
    const files = new Map<string, Uint8Array>();
    for (const [path, content] of Object.entries(TINY_ZARR_FILES)) {
      files.set(path, decodeBase64(content));
    }

    const originalCountFrames = TrajectoryReader.prototype.countFrames;
    let counts = 0;
    TrajectoryReader.prototype.countFrames = function (
      this: TrajectoryReader,
    ): number {
      counts += 1;
      return originalCountFrames.call(this);
    };

    try {
      const bundle = loadMrecStore(files);
      try {
        expect(counts).toBeGreaterThan(0);
      } finally {
        bundle.dispose();
      }
    } finally {
      TrajectoryReader.prototype.countFrames = originalCountFrames;
    }
  });
});

describe("loadMrecFiles / loadMrecDirectory", () => {
  it("opens a two-frame molrec trajectory through TrajectoryReader", () => {
    const bundle = loadMrecFiles(TINY_ZARR_FILES);
    try {
      expect(bundle.trajectory.length).toBe(2);
      const first = viewAtomCoords(
        bundle.trajectory.get(0)!.getBlock("atoms")!,
      );
      const second = viewAtomCoords(
        bundle.trajectory.get(1)!.getBlock("atoms")!,
      );
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(Array.from(first!.x)).toEqual([0, 1]);
      expect(Array.from(second!.x)).toEqual([2, 3]);
      expect(bundle.trajectory.get(0)!.getBlock("atoms")!.nrows()).toBe(2);
    } finally {
      bundle.dispose();
    }
  });

  it("opens the same store from a directory source", async () => {
    const bundle = await loadMrecDirectory(memoryMrecSource(TINY_ZARR_FILES));
    try {
      expect(bundle.trajectory.length).toBe(2);
      const atoms = bundle.trajectory.get(0)!.getBlock("atoms")!;
      expect(atoms.copyColStr("element")).toEqual(["H", "He"]);
    } finally {
      bundle.dispose();
    }
  });
});
