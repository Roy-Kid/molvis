import * as molrs from "@molcrafts/molvis-core/molrs";
import {
  TrajectoryReader,
  WasmLammpsDataStream,
  WasmLammpsDumpStream,
  WasmPdbStream,
  WasmSdfStream,
  WasmXyzStream,
} from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import {
  isStoreFormat,
  MOLRS_STORE_READERS,
  MOLRS_TRAJ_STREAMS,
} from "../../../src/transport/trajectory_worker/streams";

describe("MOLRS_TRAJ_STREAMS", () => {
  it("maps every worker Format to a molrs stream constructor", () => {
    expect(MOLRS_TRAJ_STREAMS["lammps-dump"]).toBe(WasmLammpsDumpStream);
    expect(MOLRS_TRAJ_STREAMS.xyz).toBe(WasmXyzStream);
    expect(MOLRS_TRAJ_STREAMS.pdb).toBe(WasmPdbStream);
    expect(MOLRS_TRAJ_STREAMS.lammps).toBe(WasmLammpsDataStream);
    expect(MOLRS_TRAJ_STREAMS.sdf).toBe(WasmSdfStream);
    expect(Object.hasOwn(MOLRS_TRAJ_STREAMS, "dcd")).toBe(true);
    expect(Object.hasOwn(MOLRS_TRAJ_STREAMS, "xtc")).toBe(true);
    expect(Object.hasOwn(MOLRS_TRAJ_STREAMS, "trr")).toBe(true);
  });

  it("uses the molrs export for DCD/XTC/TRR when that package ships them", () => {
    for (const [format, name] of [
      ["dcd", "WasmDcdStream"],
      ["xtc", "WasmXtcStream"],
      ["trr", "WasmTrrStream"],
    ] as const) {
      const shipped = (molrs as Record<string, unknown>)[name];
      if (typeof shipped === "function") {
        expect(MOLRS_TRAJ_STREAMS[format]).toBe(shipped);
      }
    }
  });
});

describe("MOLRS_STORE_READERS", () => {
  it("routes the mrec store format to molrs TrajectoryReader", () => {
    expect(MOLRS_STORE_READERS.mrec).toBe(TrajectoryReader);
    expect(isStoreFormat("mrec")).toBe(true);
    expect(isStoreFormat("xyz")).toBe(false);
    // No byte stream exists for a store format.
    expect(Object.hasOwn(MOLRS_TRAJ_STREAMS, "mrec")).toBe(false);
  });
});
