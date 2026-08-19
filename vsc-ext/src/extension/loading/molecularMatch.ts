/**
 * Host-side molecular path matching. Kept free of `vscode` and of the
 * stage package so unit tests can load it from CJS mocha.
 *
 * Extension list must stay aligned with `FILE_FORMAT_REGISTRY`
 * (`@molcrafts/molvis-stage/io/formats`) plus extension-less VASP names.
 */

/** Exclude build/deps trees from the Activity Bar Files scan. */
export const WORKSPACE_FILE_EXCLUDE =
  "**/{node_modules,.git,out,dist,out-test,.venv,venv}/**";

const EXTENSIONS = [
  "pdb",
  "ent",
  "brk",
  "xyz",
  "extxyz",
  "exyz",
  "cif",
  "mmcif",
  "data",
  "lmp",
  "lammps",
  "lammpsdata",
  "dump",
  "lammpstrj",
  "lmptrj",
  "lammpsdump",
  "sdf",
  "mol",
  "dcd",
  "cube",
  "cub",
  "chgcar",
  "gro",
  "mol2",
  "poscar",
  "contcar",
  "vasp",
  "trr",
  "xtc",
] as const;

const EXTENSION_SET = new Set<string>(EXTENSIONS);

function basenameOf(filePath: string): string {
  const trimmed = filePath.trim();
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function extensionOf(filePath: string): string {
  const base = basenameOf(filePath);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** True when the path is a registered molecular file (or a `.zarr` directory). */
export function isMolecularPath(filePath: string): boolean {
  if (filePath.endsWith(".zarr") || filePath.endsWith(".zarr/")) return true;
  const base = basenameOf(filePath);
  if (base === "CHGCAR" || base.startsWith("CHGCAR_")) return true;
  if (
    base === "POSCAR" ||
    base === "CONTCAR" ||
    base.startsWith("POSCAR_") ||
    base.startsWith("CONTCAR_")
  ) {
    return true;
  }
  const ext = extensionOf(filePath);
  return ext.length > 0 && EXTENSION_SET.has(ext);
}

/** Connection-table files belong on Sketch, not Stage. */
export function isSketchPath(filePath: string): boolean {
  const ext = extensionOf(filePath);
  return ext === "sdf" || ext === "mol";
}

/**
 * `workspace.findFiles` include globs for every registered extension plus
 * extension-less VASP names (`CHGCAR`, `POSCAR`, `CONTCAR`).
 */
export function workspaceMolecularIncludeGlobs(): string[] {
  return [
    `**/*.{${EXTENSIONS.join(",")}}`,
    "**/CHGCAR",
    "**/CHGCAR_*",
    "**/POSCAR",
    "**/POSCAR_*",
    "**/CONTCAR",
    "**/CONTCAR_*",
  ];
}
