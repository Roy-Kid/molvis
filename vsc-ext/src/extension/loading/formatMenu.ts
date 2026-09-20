/**
 * Format-picker copy aligned to molrs WASM IO (`FILE_FORMAT_REGISTRY`).
 * `Software kind - .ext`, e.g. `LAMMPS data - .data`, `LAMMPS traj - .dump`.
 */

import type { FileFormat } from "../../protocol";

export type FormatMenuEntry = {
  format: FileFormat;
  /** Software / family, e.g. LAMMPS, VASP, GROMACS. */
  software: string;
  /** What kind of file, e.g. data, traj, structure. */
  kind: string;
  /** Display suffixes, with a leading dot (or a VASP basename). */
  suffixes: readonly string[];
};

export const FORMAT_MENU: readonly FormatMenuEntry[] = [
  { format: "pdb", software: "PDB", kind: "structure", suffixes: [".pdb"] },
  { format: "xyz", software: "XYZ", kind: "coords", suffixes: [".xyz"] },
  { format: "cif", software: "CIF", kind: "crystal", suffixes: [".cif"] },
  { format: "lammps", software: "LAMMPS", kind: "data", suffixes: [".data"] },
  {
    format: "lammps-dump",
    software: "LAMMPS",
    kind: "traj",
    suffixes: [".dump"],
  },
  {
    format: "sdf",
    software: "SDF",
    kind: "molecule",
    suffixes: [".sdf", ".mol"],
  },
  { format: "dcd", software: "DCD", kind: "traj", suffixes: [".dcd"] },
  {
    format: "cube",
    software: "Gaussian",
    kind: "cube",
    suffixes: [".cube"],
  },
  { format: "chgcar", software: "VASP", kind: "charge", suffixes: ["CHGCAR"] },
  {
    format: "gro",
    software: "GROMACS",
    kind: "structure",
    suffixes: [".gro"],
  },
  { format: "mol2", software: "MOL2", kind: "molecule", suffixes: [".mol2"] },
  {
    format: "poscar",
    software: "VASP",
    kind: "structure",
    suffixes: ["POSCAR"],
  },
  { format: "trr", software: "GROMACS", kind: "traj", suffixes: [".trr"] },
  { format: "xtc", software: "GROMACS", kind: "traj", suffixes: [".xtc"] },
];

export function formatMenuLabel(entry: FormatMenuEntry): string {
  return `${entry.software} ${entry.kind} - ${entry.suffixes.join(", ")}`;
}
