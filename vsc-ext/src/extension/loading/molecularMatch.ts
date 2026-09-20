/**
 * Host-side molecular path matching. Kept free of `vscode` and of the
 * stage package so unit tests can load it from CJS mocha.
 *
 * Extension list must stay aligned with `FILE_FORMAT_REGISTRY`
 * (`@molcrafts/molvis-stage/io/formats`) plus extension-less VASP names.
 */

import { isMrecZipPath, isStlPath, mrecStoreRootPath } from "./pathUtils";

/**
 * Exclude build / dependency / cache trees from the Activity Bar Files scan.
 *
 * This list is a performance contract, not tidiness. `findFiles` walks every
 * directory it is not told to skip, so one unexcluded artifact tree decides
 * how long the scan takes: a Rust `target/` runs to ~35k files and a conda
 * prefix to ~77k, and on a network filesystem that is the difference between
 * a tree that renders and a spinner that never stops. Add a directory here
 * the moment it is generated rather than authored.
 */
/**
 * Directory names never worth walking into, as a set for the lazy tree.
 *
 * Same list as {@link WORKSPACE_FILE_EXCLUDE}, in the shape a per-directory
 * read needs. Kept as one source so the two cannot disagree about what a
 * generated directory is.
 */
export const IGNORED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "out",
  "out-test",
  "dist",
  "build",
  "target",
  ".venv",
  "venv",
  ".conda",
  "conda-env",
  "site-packages",
  ".cache",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".nox",
  ".direnv",
  ".pixi",
  ".gradle",
  ".next",
  ".turbo",
  ".rustup",
  ".cargo",
]);

export const WORKSPACE_FILE_EXCLUDE =
  "**/{node_modules,.git,.hg,.svn,out,out-test,dist,build,target," +
  ".venv,venv,.conda,conda-env,site-packages,.cache,__pycache__," +
  ".mypy_cache,.pytest_cache,.ruff_cache,.tox,.nox,.direnv,.pixi," +
  ".gradle,.next,.turbo,.rustup,.cargo}/**";

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

/** Compound two-part suffix of a LAMMPS `dump local` topology overlay.
 *  Keep in lockstep with `DUMP_LOCAL_SUFFIX` in
 *  `@molcrafts/molvis-stage/io/formats`. */
const DUMP_LOCAL_SUFFIX = ".dump.local";

function isDumpLocalPath(filePath: string): boolean {
  return filePath.trim().toLowerCase().endsWith(DUMP_LOCAL_SUFFIX);
}

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

/**
 * True when the path is something the stage can open: a registered molecular
 * file, a `.mrec` directory or packed `.mrec.zip`, or an `.stl` mesh.
 */
export function isMolecularPath(filePath: string): boolean {
  if (mrecStoreRootPath(filePath) || isMrecZipPath(filePath)) return true;
  // Scene geometry rather than a parsed format — it has no `FileFormat`, the
  // same reason mrec is matched by suffix above and not by the extension set.
  if (isStlPath(filePath)) return true;
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
  if (isDumpLocalPath(filePath)) return true;
  const ext = extensionOf(filePath);
  return ext.length > 0 && EXTENSION_SET.has(ext);
}

const BINARY_TRAJECTORY_EXTENSIONS = new Set(["dcd", "trr", "xtc"]);

/** DCD/TRR/XTC — must not open as a text document. */
export function isBinaryTrajectoryPath(filePath: string): boolean {
  return BINARY_TRAJECTORY_EXTENSIONS.has(extensionOf(filePath));
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
    `**/*${DUMP_LOCAL_SUFFIX}`,
    "**/*.mrec/zarr.json",
    "**/*.mrec.zip",
    "**/*.stl",
    "**/CHGCAR",
    "**/CHGCAR_*",
    "**/POSCAR",
    "**/POSCAR_*",
    "**/CONTCAR",
    "**/CONTCAR_*",
  ];
}

/**
 * The same set as one pattern, for callers that walk the tree.
 *
 * `findFiles` costs a directory walk per pattern, not per match, so running
 * the list above one glob at a time pays for the whole workspace eleven times
 * over. Anything that scans uses this; the list stays for `createFileSystemWatcher`,
 * which takes one pattern per watcher by construction.
 */
export function workspaceMolecularIncludeGlob(): string {
  const alternatives = [
    ...EXTENSIONS.map((ext) => `*.${ext}`),
    `*${DUMP_LOCAL_SUFFIX}`,
    "*.mrec.zip",
    "*.stl",
    "CHGCAR",
    "CHGCAR_*",
    "POSCAR",
    "POSCAR_*",
    "CONTCAR",
    "CONTCAR_*",
  ];
  return `**/{${alternatives.join(",")}}`;
}
