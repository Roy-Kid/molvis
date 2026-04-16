import { describe, expect, it } from "@rstest/core";
import {
  deriveElementFromType,
  inferFormatFromFilename,
} from "../src/io/reader";

describe("inferFormatFromFilename", () => {
  it("should detect PDB files", () => {
    expect(inferFormatFromFilename("protein.pdb")).toBe("pdb");
    expect(inferFormatFromFilename("MOLECULE.PDB")).toBe("pdb");
  });

  it("should detect XYZ files", () => {
    expect(inferFormatFromFilename("water.xyz")).toBe("xyz");
    expect(inferFormatFromFilename("trajectory.XYZ")).toBe("xyz");
  });

  it("should detect LAMMPS files", () => {
    expect(inferFormatFromFilename("system.lammps")).toBe("lammps");
    expect(inferFormatFromFilename("system.lmp")).toBe("lammps");
    expect(inferFormatFromFilename("system.data")).toBe("lammps");
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

describe("deriveElementFromType", () => {
  it("should return known element symbols directly", () => {
    expect(deriveElementFromType("C")).toBe("C");
    expect(deriveElementFromType("N")).toBe("N");
    expect(deriveElementFromType("O")).toBe("O");
    expect(deriveElementFromType("H")).toBe("H");
  });

  it("should match two-letter elements", () => {
    expect(deriveElementFromType("Ca")).toBe("Ca");
    expect(deriveElementFromType("Fe")).toBe("Fe");
    expect(deriveElementFromType("Na")).toBe("Na");
  });

  it("should extract element from longer type names", () => {
    // "CA" -> first 2 chars "Ca" (calcium) matches in periodic table
    expect(deriveElementFromType("CA")).toBe("Ca");
    // "OW" -> "Ow" not an element, first char "O" is
    expect(deriveElementFromType("OW")).toBe("O");
  });

  it("should try first two chars then first char", () => {
    // "Hx" -> "Hx" is not an element, first char "H" is
    expect(deriveElementFromType("Hx")).toBe("H");
  });

  it("should fallback to C for unknown types", () => {
    expect(deriveElementFromType("XQ")).toBe("C");
    expect(deriveElementFromType("???")).toBe("C");
  });
});
