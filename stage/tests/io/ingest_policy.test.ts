import { describe, expect, it } from "@rstest/core";
import {
  decideIngest,
  dropLoadMode,
  FILE_FORMAT_REGISTRY,
  ingestKind,
  STREAMING_FILE_THRESHOLD_BYTES,
  TRAJECTORY_WHOLE_FILE_CAP_BYTES,
} from "../../src/io/formats";

describe("ingestKind", () => {
  it("classifies LAMMPS data as a structure, not a trajectory", () => {
    expect(ingestKind("lammps")).toBe("structure");
  });

  it("classifies dumps and binary traj formats as trajectories", () => {
    expect(ingestKind("lammps-dump")).toBe("trajectory");
    expect(ingestKind("xyz")).toBe("trajectory");
    expect(ingestKind("dcd")).toBe("trajectory");
    expect(ingestKind("trr")).toBe("trajectory");
    expect(ingestKind("xtc")).toBe("trajectory");
  });

  it("sets ingest on every registry entry", () => {
    for (const entry of FILE_FORMAT_REGISTRY) {
      expect(entry.ingest).toBe(ingestKind(entry.format));
    }
  });
});

describe("dropLoadMode", () => {
  it("installs the first drop and stacks the next (data + dcd)", () => {
    expect(dropLoadMode(0)).toBe("replace");
    expect(dropLoadMode(1)).toBe("augment");
    expect(dropLoadMode(2)).toBe("augment");
  });
});

describe("decideIngest", () => {
  it("opens a large LAMMPS data file as one structure", () => {
    const huge = TRAJECTORY_WHOLE_FILE_CAP_BYTES * 4;
    expect(decideIngest("lammps", huge)).toEqual({ path: "whole-file" });
  });

  it("streams a text trajectory above the worker threshold", () => {
    expect(decideIngest("lammps-dump", STREAMING_FILE_THRESHOLD_BYTES)).toEqual(
      { path: "stream" },
    );
    expect(decideIngest("xyz", STREAMING_FILE_THRESHOLD_BYTES * 2)).toEqual({
      path: "stream",
    });
  });

  it("keeps a small trajectory on the whole-file path", () => {
    expect(decideIngest("xyz", 1024)).toEqual({ path: "whole-file" });
  });

  it("streams a binary trajectory at the cap when the host can range-read", () => {
    expect(decideIngest("dcd", TRAJECTORY_WHOLE_FILE_CAP_BYTES)).toEqual({
      path: "stream",
    });
  });

  it("refuses a huge binary trajectory when the host still copies the whole file", () => {
    const decision = decideIngest("dcd", TRAJECTORY_WHOLE_FILE_CAP_BYTES, {
      hostCanRange: false,
    });
    expect(decision.path).toBe("refuse");
    if (decision.path === "refuse") {
      expect(decision.reason).toMatch(/dcd|range|buffer|memory/i);
    }
  });

  it("does not refuse a streamable trajectory of any size when the host can range-read", () => {
    expect(
      decideIngest("lammps-dump", TRAJECTORY_WHOLE_FILE_CAP_BYTES * 8),
    ).toEqual({ path: "stream" });
  });

  it("refuses a huge streamable dump when the host still copies the whole file", () => {
    const decision = decideIngest(
      "lammps-dump",
      TRAJECTORY_WHOLE_FILE_CAP_BYTES,
      { hostCanRange: false },
    );
    expect(decision.path).toBe("refuse");
    if (decision.path === "refuse") {
      expect(decision.reason).toMatch(/range/i);
    }
  });

  it("still streams a mid-size dump on a whole-file host", () => {
    expect(
      decideIngest("lammps-dump", STREAMING_FILE_THRESHOLD_BYTES, {
        hostCanRange: false,
      }),
    ).toEqual({ path: "stream" });
  });

  it("opens structures whole-file even when a stream reader exists", () => {
    expect(decideIngest("lammps", STREAMING_FILE_THRESHOLD_BYTES * 2)).toEqual({
      path: "whole-file",
    });
  });
});
