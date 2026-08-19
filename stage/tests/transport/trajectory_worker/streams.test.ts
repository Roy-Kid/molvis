import * as molrs from "@molcrafts/molvis-core/molrs";
import {
  WasmLammpsDataStream,
  WasmLammpsDumpStream,
  WasmPdbStream,
  WasmSdfStream,
  WasmXyzStream,
} from "@molcrafts/molvis-core/molrs";
import { describe, expect, it } from "@rstest/core";
import { MOLRS_TRAJ_STREAMS } from "../../../src/transport/trajectory_worker/streams";

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
