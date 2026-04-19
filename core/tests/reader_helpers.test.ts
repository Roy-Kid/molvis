import { describe, expect, it } from "@rstest/core";
import { inferFormatFromFilename } from "../src/io/reader";

describe("inferFormatFromFilename", () => {
  it("should detect PDB files", () => {
    expect(inferFormatFromFilename("protein.pdb")).toBe("pdb");
    expect(inferFormatFromFilename("MOLECULE.PDB")).toBe("pdb");
  });

  it("should detect XYZ files", () => {
    expect(inferFormatFromFilename("water.xyz")).toBe("xyz");
    expect(inferFormatFromFilename("trajectory.XYZ")).toBe("xyz");
  });

  it("should detect LAMMPS data files", () => {
    expect(inferFormatFromFilename("system.lammps")).toBe("lammps");
    expect(inferFormatFromFilename("system.lmp")).toBe("lammps");
    expect(inferFormatFromFilename("system.data")).toBe("lammps");
  });

  it("should detect LAMMPS dump files", () => {
    expect(inferFormatFromFilename("traj.dump")).toBe("lammps-dump");
    expect(inferFormatFromFilename("traj.lammpstrj")).toBe("lammps-dump");
  });

  it("should fallback to default for unknown extensions", () => {
    expect(inferFormatFromFilename("file.unknown")).toBe("pdb");
    expect(inferFormatFromFilename("noextension")).toBe("pdb");
  });

  it("should support custom fallback", () => {
    expect(inferFormatFromFilename("file.unknown", "xyz")).toBe("xyz");
  });

  it("should handle files with spaces and dots", () => {
    expect(inferFormatFromFilename("my file.v2.pdb")).toBe("pdb");
    expect(inferFormatFromFilename("  trajectory.xyz  ")).toBe("xyz");
  });

  it("should handle empty string", () => {
    expect(inferFormatFromFilename("")).toBe("pdb");
  });
});
