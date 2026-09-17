import { describe, expect, it } from "@rstest/core";
import {
  canStream,
  describeFormat,
  directoryFormats,
  FILE_FORMAT_REGISTRY,
  getAllAcceptExtensions,
  inferFormatFromFilename,
  isBinaryFormat,
  isMrecZipPath,
  isStlPath,
  MREC_ZIP_SUFFIX,
  matchBondEndpointColumns,
  mrecStoreRootPath,
  STL_SUFFIX,
} from "../../src/io/formats";

describe("inferFormatFromFilename", () => {
  it("detects PDB files across common extensions", () => {
    expect(inferFormatFromFilename("protein.pdb")).toBe("pdb");
    expect(inferFormatFromFilename("MOLECULE.PDB")).toBe("pdb");
    expect(inferFormatFromFilename("chain.ent")).toBe("pdb");
    expect(inferFormatFromFilename("legacy.brk")).toBe("pdb");
  });

  it("detects XYZ / extended-XYZ files", () => {
    expect(inferFormatFromFilename("water.xyz")).toBe("xyz");
    expect(inferFormatFromFilename("trajectory.XYZ")).toBe("xyz");
    expect(inferFormatFromFilename("props.extxyz")).toBe("xyz");
    expect(inferFormatFromFilename("props.exyz")).toBe("xyz");
  });

  it("detects CIF / mmCIF files", () => {
    expect(inferFormatFromFilename("crystal.cif")).toBe("cif");
    expect(inferFormatFromFilename("CRYSTAL.CIF")).toBe("cif");
    expect(inferFormatFromFilename("complex.mmcif")).toBe("cif");
  });

  it("detects LAMMPS data files across common extensions", () => {
    expect(inferFormatFromFilename("system.lammps")).toBe("lammps");
    expect(inferFormatFromFilename("system.lmp")).toBe("lammps");
    expect(inferFormatFromFilename("system.data")).toBe("lammps");
    expect(inferFormatFromFilename("system.lammpsdata")).toBe("lammps");
  });

  it("detects LAMMPS dump / trajectory files", () => {
    expect(inferFormatFromFilename("traj.dump")).toBe("lammps-dump");
    expect(inferFormatFromFilename("traj.lammpstrj")).toBe("lammps-dump");
    expect(inferFormatFromFilename("traj.lmptrj")).toBe("lammps-dump");
    expect(inferFormatFromFilename("traj.lammpsdump")).toBe("lammps-dump");
    expect(inferFormatFromFilename("bonds.dump.local")).toBe("lammps-dump");
    expect(inferFormatFromFilename("BONDS.DUMP.LOCAL")).toBe("lammps-dump");
  });

  it("does not treat a bare .local extension as LAMMPS dump", () => {
    expect(inferFormatFromFilename("notes.local")).toBeNull();
  });

  it("returns null for unknown extensions rather than guessing", () => {
    expect(inferFormatFromFilename("file.unknown")).toBeNull();
    expect(inferFormatFromFilename("file.bogus")).toBeNull();
    expect(inferFormatFromFilename("noextension")).toBeNull();
  });

  it("handles files with spaces and multiple dots", () => {
    expect(inferFormatFromFilename("my file.v2.pdb")).toBe("pdb");
    expect(inferFormatFromFilename("  trajectory.xyz  ")).toBe("xyz");
  });

  it("returns null for empty input", () => {
    expect(inferFormatFromFilename("")).toBeNull();
  });

  it("detects GROMACS / VASP extensions and basenames", () => {
    expect(inferFormatFromFilename("conf.gro")).toBe("gro");
    expect(inferFormatFromFilename("ligand.mol2")).toBe("mol2");
    expect(inferFormatFromFilename("traj.trr")).toBe("trr");
    expect(inferFormatFromFilename("traj.xtc")).toBe("xtc");
    expect(inferFormatFromFilename("foo.poscar")).toBe("poscar");
    expect(inferFormatFromFilename("POSCAR")).toBe("poscar");
    expect(inferFormatFromFilename("CONTCAR")).toBe("poscar");
    expect(inferFormatFromFilename("/path/to/POSCAR")).toBe("poscar");
  });
});

describe("format registry flags", () => {
  it("registers gro, mol2, poscar, trr, xtc", () => {
    const formats = FILE_FORMAT_REGISTRY.map((d) => d.format);
    for (const f of ["gro", "mol2", "poscar", "trr", "xtc"]) {
      expect(formats).toContain(f);
    }
  });

  it("classifies trr/xtc as binary and text formats as text", () => {
    expect(isBinaryFormat("trr")).toBe(true);
    expect(isBinaryFormat("xtc")).toBe(true);
    expect(isBinaryFormat("gro")).toBe(false);
    expect(isBinaryFormat("mol2")).toBe(false);
    expect(isBinaryFormat("poscar")).toBe(false);
  });

  it("marks gro/mol2/poscar as non-streamable", () => {
    for (const f of ["gro", "mol2", "poscar"] as const) {
      expect(canStream(f)).toBe(false);
    }
  });

  it("streams dcd/trr/xtc through the same MolRS worker surface", () => {
    expect(canStream("dcd")).toBe(true);
    expect(canStream("trr")).toBe(true);
    expect(canStream("xtc")).toBe(true);
  });
});

describe("getAllAcceptExtensions", () => {
  it("emits a dotted comma-separated list of every registered extension", () => {
    const result = getAllAcceptExtensions();
    const parts = result.split(",");
    for (const entry of FILE_FORMAT_REGISTRY) {
      for (const ext of entry.extensions) {
        expect(parts).toContain(`.${ext}`);
      }
    }
  });

  it("does not double-count extensions", () => {
    const parts = getAllAcceptExtensions().split(",");
    expect(new Set(parts).size).toBe(parts.length);
  });

  it("offers the .dump.local compound suffix", () => {
    expect(getAllAcceptExtensions().split(",")).toContain(".dump.local");
  });
});

describe("describeFormat", () => {
  it("returns the descriptor for every canonical format", () => {
    for (const entry of FILE_FORMAT_REGISTRY) {
      expect(describeFormat(entry.format)).toBe(entry);
    }
  });
});

describe("cube / chgcar inference", () => {
  it("registers cube and chgcar entries", () => {
    const formats = FILE_FORMAT_REGISTRY.map((d) => d.format);
    expect(formats).toContain("cube");
    expect(formats).toContain("chgcar");
  });

  it("infers cube from .cube and .cub", () => {
    expect(inferFormatFromFilename("water.cube")).toBe("cube");
    expect(inferFormatFromFilename("orbitals.cub")).toBe("cube");
    expect(inferFormatFromFilename("WATER.CUBE")).toBe("cube");
  });

  it("infers chgcar from extension and CHGCAR basename", () => {
    expect(inferFormatFromFilename("foo.chgcar")).toBe("chgcar");
    expect(inferFormatFromFilename("CHGCAR")).toBe("chgcar");
    expect(inferFormatFromFilename("CHGCAR_sum")).toBe("chgcar");
    expect(inferFormatFromFilename("/path/to/CHGCAR")).toBe("chgcar");
    expect(inferFormatFromFilename("chgcar")).toBe(null);
  });
});

describe("packed mrec (.mrec.zip)", () => {
  it("isMrecZipPath matches only the packed suffix, case-insensitively", () => {
    expect(isMrecZipPath("/runs/growth.mrec.zip")).toBe(true);
    expect(isMrecZipPath("C:\\runs\\GROWTH.MREC.ZIP")).toBe(true);
    expect(isMrecZipPath("growth.mrec")).toBe(false);
    expect(isMrecZipPath("growth.mrec/zarr.json")).toBe(false);
    expect(isMrecZipPath("archive.zip")).toBe(false);
  });

  it("a packed store is a file, not a directory store", () => {
    expect(mrecStoreRootPath("/runs/growth.mrec.zip")).toBeUndefined();
    expect(inferFormatFromFilename("growth.mrec.zip")).toBeNull();
    expect(MREC_ZIP_SUFFIX).toBe(".mrec.zip");
  });

  it("the accept list offers both store forms", () => {
    const accept = getAllAcceptExtensions().split(",");
    expect(accept).toContain(".mrec");
    expect(accept).toContain(".mrec.zip");
    expect(directoryFormats[0].packedSuffix).toBe(MREC_ZIP_SUFFIX);
  });
});

describe("STL meshes (.stl)", () => {
  it("isStlPath matches only the suffix, case-insensitively", () => {
    expect(isStlPath("/runs/cavity.stl")).toBe(true);
    expect(isStlPath("C:\\meshes\\CAVITY.STL")).toBe(true);
    expect(isStlPath("cavity.stl.gz")).toBe(false);
    expect(isStlPath("still.lammpstrj")).toBe(false);
  });

  it("is not a parsed format: it carries no atoms", () => {
    // Routing an STL to a Frame reader would be a category error, so
    // inference must not claim one.
    expect(inferFormatFromFilename("cavity.stl")).toBeNull();
  });

  it("the accept list still offers it", () => {
    expect(getAllAcceptExtensions().split(",")).toContain(".stl");
    expect(STL_SUFFIX).toBe(".stl");
  });
});

describe("matchBondEndpointColumns", () => {
  it("takes the compute property/local attribute names", () => {
    expect(
      matchBondEndpointColumns(["index", "batom1", "batom2", "btype"]),
    ).toEqual(["batom1", "batom2"]);
  });

  it("takes OVITO's own standard-property spelling", () => {
    expect(
      matchBondEndpointColumns([
        "ParticleIdentifiers.A",
        "ParticleIdentifiers.B",
      ]),
    ).toEqual(["ParticleIdentifiers.A", "ParticleIdentifiers.B"]);
  });

  it("matches case-insensitively but reports the file's own spelling", () => {
    expect(matchBondEndpointColumns(["BAtom1", "BATOM2"])).toEqual([
      "BAtom1",
      "BATOM2",
    ]);
  });

  it("refuses the default dump local column names", () => {
    // `dump local c_bond[1] c_bond[2] c_bond[3]` with no `dump_modify colname`
    // — the names carry no meaning, so this must reach the user, not a guess.
    expect(
      matchBondEndpointColumns([
        "index",
        "c_bond[1]",
        "c_bond[2]",
        "c_bond[3]",
      ]),
    ).toBe(undefined);
  });

  it("refuses a half-present pair", () => {
    expect(matchBondEndpointColumns(["batom1", "c_bond[2]"])).toBe(undefined);
  });

  it("prefers the attribute names when a file carries both spellings", () => {
    expect(
      matchBondEndpointColumns([
        "batom1",
        "batom2",
        "ParticleIdentifiers.A",
        "ParticleIdentifiers.B",
      ]),
    ).toEqual(["batom1", "batom2"]);
  });
});
