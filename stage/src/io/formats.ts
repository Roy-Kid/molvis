/**
 * File-format registry and extension inference.
 *
 * This module intentionally has **no dependencies** on the rest of core
 * (no BabylonJS, no WASM, no logger) so that host-side tooling — such as
 * the VS Code extension's activation bundle — can import the registry and
 * run `inferFormatFromFilename` / `getAllAcceptExtensions` without
 * dragging in the rendering engine. The parser dispatch itself lives in
 * `reader.ts`, which imports from here.
 */

export type FileFormat =
  | "pdb"
  | "xyz"
  | "cif"
  | "lammps"
  | "lammps-dump"
  | "sdf"
  | "dcd"
  | "cube"
  | "chgcar"
  | "gro"
  | "mol2"
  | "poscar"
  | "trr"
  | "xtc";

/**
 * Whether a format's reader consumes the file as a UTF-8 string (`"text"`)
 * or as raw bytes (`"binary"`). Determines which payload variant of
 * `FileContent` the eager ingress (`loadFileContent`) accepts and which
 * WASM reader constructor signature is used (`new XReader(content: string)`
 * vs `new XReader(bytes: Uint8Array)`).
 */
export type FormatPayload = "text" | "binary";

/**
 * How a format relates to the streaming-worker ingress
 * (`loadFileStream` + `transport/trajectory_worker/`).
 *
 * - `"eager-only"` — no streaming reader exists; the whole file must be
 *   materialized before parsing. Used by formats whose payload is
 *   structurally indivisible (zarr directory, volumetric grids).
 * - `"streaming-preferred"` — both an eager (`loadFileContent`) and a
 *   streaming (`loadFileStream`) reader exist. Hosts pick by file size /
 *   user intent. The default for everything multi-frame.
 * - `"streaming-only"` — file size or random-access requirements rule
 *   out materializing the whole file at once; eager path is unsupported
 *   and would throw. Reserved for future binary trajectories so big the
 *   eager path makes no sense.
 */
export type StreamingCapability =
  | "eager-only"
  | "streaming-preferred"
  | "streaming-only";

/**
 * Product ingest kind. Independent of {@link StreamingCapability}:
 * a format may have a stream *reader* and still be a one-frame structure
 * (LAMMPS data). Only `"trajectory"` files get a frame index / `.molidx`.
 */
export type IngestKind = "structure" | "trajectory";

/** Size at which a *trajectory* prefers the streaming worker over a
 *  whole-content reader. Structures ignore this. */
export const STREAMING_FILE_THRESHOLD_BYTES = 16 * 1024 * 1024;

/** Whole-file materialize of a trajectory at or above this size is
 *  refused. Streamable hosts (page `File` handle) never hit this:
 *  {@link decideIngest} sends those to `"stream"`. */
export const TRAJECTORY_WHOLE_FILE_CAP_BYTES = 512 * 1024 * 1024;

export type IngestDecision =
  | { path: "stream" }
  | { path: "whole-file" }
  | { path: "refuse"; reason: string };

export interface FileFormatDescriptor {
  readonly format: FileFormat;
  readonly label: string;
  readonly description: string;
  readonly extensions: readonly string[];
  /** Whether the reader takes a `string` or `Uint8Array`. */
  readonly payload: FormatPayload;
  /** Whether the streaming-worker path is available for this format. */
  readonly streaming: StreamingCapability;
  /** Structure = one frame, no index. Trajectory = N frames + index. */
  readonly ingest: IngestKind;
  /** Whether molrs (via WASM) has a writer for this format (export support). */
  readonly writable: boolean;
}

export const FILE_FORMAT_REGISTRY: readonly FileFormatDescriptor[] = [
  {
    format: "pdb",
    label: "PDB structure",
    description: "RCSB PDB-style ATOM/HETATM records (.pdb, .ent, .brk)",
    extensions: ["pdb", "ent", "brk"],
    payload: "text",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
  {
    format: "xyz",
    label: "XYZ coords",
    description:
      "Cartesian coordinates, optional properties header (.xyz, .extxyz, .exyz)",
    extensions: ["xyz", "extxyz", "exyz"],
    payload: "text",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
  {
    format: "cif",
    label: "CIF crystal",
    description:
      "IUCr CIF / mmCIF — atomic coordinates plus unit cell that becomes frame.box (.cif, .mmcif)",
    extensions: ["cif", "mmcif"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: true,
  },
  {
    format: "lammps",
    label: "LAMMPS data",
    description:
      "LAMMPS data / restart-text file (.data, .lmp, .lammps, .lammpsdata)",
    extensions: ["data", "lmp", "lammps", "lammpsdata"],
    payload: "text",
    streaming: "streaming-preferred",
    ingest: "structure",
    writable: true,
  },
  {
    format: "lammps-dump",
    label: "LAMMPS traj",
    description:
      "LAMMPS dump trajectory (.dump, .lammpstrj, .lmptrj, .lammpsdump)",
    extensions: ["dump", "lammpstrj", "lmptrj", "lammpsdump"],
    payload: "text",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
  {
    format: "sdf",
    label: "SDF molecule",
    description:
      "MDL V2000 connection table; multi-record SDF exposes each record as a frame (.sdf, .mol)",
    extensions: ["sdf", "mol"],
    payload: "text",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: false,
  },
  {
    format: "dcd",
    label: "DCD traj",
    description:
      "Binary CHARMM/NAMD-style trajectory; fixed-stride frames after a small header (.dcd)",
    extensions: ["dcd"],
    payload: "binary",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
  {
    format: "cube",
    label: "Gaussian cube",
    description:
      "Gaussian-style volumetric scalar field with embedded geometry (.cube, .cub)",
    extensions: ["cube", "cub"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: true,
  },
  {
    format: "chgcar",
    label: "VASP charge",
    description:
      "VASP charge density / spin density (filename CHGCAR or CHGCAR_*; .chgcar accepted for renames)",
    extensions: ["chgcar"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: false,
  },
  {
    format: "gro",
    label: "GROMACS structure",
    description:
      "GROMACS structure / trajectory; fixed-column atoms + box, coordinates nm\u2192\u00c5 on read (.gro)",
    extensions: ["gro"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: true,
  },
  {
    format: "mol2",
    label: "MOL2 molecule",
    description:
      "Tripos MOL2 connection table; @<TRIPOS> sections, atoms + bonds (.mol2)",
    extensions: ["mol2"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: true,
  },
  {
    format: "poscar",
    label: "VASP structure",
    description:
      "VASP crystal cell + atoms (filename POSCAR/CONTCAR or .poscar/.contcar/.vasp)",
    extensions: ["poscar", "contcar", "vasp"],
    payload: "text",
    streaming: "eager-only",
    ingest: "structure",
    writable: true,
  },
  {
    format: "trr",
    label: "GROMACS traj",
    description:
      "GROMACS full-precision binary trajectory; coordinates nm\u2192\u00c5 on read (.trr)",
    extensions: ["trr"],
    payload: "binary",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
  {
    format: "xtc",
    label: "GROMACS traj",
    description:
      "GROMACS compressed binary trajectory; coordinates nm\u2192\u00c5 on read (.xtc)",
    extensions: ["xtc"],
    payload: "binary",
    streaming: "streaming-preferred",
    ingest: "trajectory",
    writable: true,
  },
];

/** Returns the descriptor for a canonical FileFormat. */
export function describeFormat(format: FileFormat): FileFormatDescriptor {
  const descriptor = FILE_FORMAT_REGISTRY.find((d) => d.format === format);
  if (!descriptor) {
    throw new Error(`No descriptor registered for format "${format}"`);
  }
  return descriptor;
}

/**
 * Flat list of every registered extension, prefixed with `.` — suitable
 * for use directly as the `accept` attribute of a file input, or as the
 * `filters` array of a VS Code quick-pick.
 */
export function getAllAcceptExtensions(): string {
  const exts: string[] = [];
  for (const entry of FILE_FORMAT_REGISTRY) {
    for (const ext of entry.extensions) {
      exts.push(`.${ext}`);
    }
  }
  return exts.join(",");
}

function extensionOf(filename: string): string {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  return dot >= 0 ? trimmed.slice(dot + 1).toLowerCase() : "";
}

function basenameOf(filename: string): string {
  const trimmed = filename.trim();
  // Handle both POSIX and Windows separators; we only care about the
  // final segment.
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/**
 * Infer a text format from the first few KB of file content.
 * Used when the extension is missing or nonstandard (e.g. `.out` dumps).
 * Returns `null` when the head is ambiguous — caller should prompt.
 */
export function sniffFormatFromTextHead(head: string): FileFormat | null {
  const sample = head.slice(0, 8192);
  // LAMMPS dump: "ITEM: TIMESTEP" is the frame marker (allow leading BOM/ws).
  if (/^\uFEFF?\s*ITEM:\s*TIMESTEP\b/im.test(sample)) {
    return "lammps-dump";
  }
  // LAMMPS data: first non-comment line is often "LAMMPS … data" or a
  // "N atoms" header after optional comments.
  if (
    /^\uFEFF?\s*LAMMPS\b/im.test(sample) &&
    /\batoms\b/i.test(sample) &&
    !/ITEM:\s*TIMESTEP/i.test(sample)
  ) {
    return "lammps";
  }
  // XYZ: first non-empty line is an integer atom count.
  if (/^\uFEFF?\s*\d+\s*(\r?\n)/.test(sample)) {
    return "xyz";
  }
  // PDB
  if (/^\uFEFF?\s*(HEADER|TITLE|ATOM {2}|HETATM|MODEL )/m.test(sample)) {
    return "pdb";
  }
  // GRO
  if (
    /\n\s*\d+\s*\n/.test(sample) &&
    /\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+\s*$/m.test(sample)
  ) {
    // Weak — only when extension already suggested gro; leave null for sniff.
  }
  return null;
}

/**
 * Infer a file format from the filename. Returns `null` when the format
 * cannot be determined — callers must then either prompt the user (page /
 * vsc-ext) or fall back explicitly. This never silently guesses, since a
 * wrong guess routes bytes through the wrong parser and produces
 * confusing error messages rather than a simple "please pick a format"
 * prompt.
 *
 * Resolution order:
 *  1. Extension-less basename match — currently only VASP CHGCAR files,
 *     whose canonical names are `CHGCAR`, `CHGCAR_sum`, `CHGCAR_diff`, …
 *     (case-sensitive — VASP filenames are uppercase by convention).
 *  2. Lowercased extension match against the registry.
 */
export function inferFormatFromFilename(filename: string): FileFormat | null {
  // 1. Extension-less canonical names.
  const base = basenameOf(filename);
  if (base === "CHGCAR" || base.startsWith("CHGCAR_")) {
    return "chgcar";
  }
  // VASP structure files are conventionally named POSCAR / CONTCAR (with
  // optional suffixes), uppercase and extension-less like CHGCAR.
  if (
    base === "POSCAR" ||
    base === "CONTCAR" ||
    base.startsWith("POSCAR_") ||
    base.startsWith("CONTCAR_")
  ) {
    return "poscar";
  }

  // 2. Extension match.
  const ext = extensionOf(filename);
  if (!ext) return null;
  for (const entry of FILE_FORMAT_REGISTRY) {
    if (entry.extensions.includes(ext)) {
      return entry.format;
    }
  }
  return null;
}

/**
 * Whether the given format's reader consumes raw bytes rather than a
 * UTF-8 string. Used by the eager ingress to pick which `FileContent`
 * variant to expect and by hosts (page / vsc-ext) to decide whether to
 * read the file with `Blob.text()` or `Blob.arrayBuffer()`.
 */
export function isBinaryFormat(format: FileFormat): boolean {
  return describeFormat(format).payload === "binary";
}

/**
 * Whether the given format supports the streaming-worker ingress
 * (`loadFileStream`). Hosts use this to decide between the eager and
 * streaming load paths — typically: `canStream(fmt) && file.size > N`
 * routes through `loadFileStream`, otherwise eager.
 *
 * Acts as a TypeScript type predicate that narrows to the
 * streaming-capable subset of {@link FileFormat}. The streaming worker's
 * `Format` type (in `transport/trajectory_worker/protocol.ts`) and this
 * narrowed type must agree — keep them in sync when a new format is
 * registered with a non-`eager-only` streaming capability.
 */
export function canStream(
  format: FileFormat,
): format is Exclude<
  FileFormat,
  "cif" | "cube" | "chgcar" | "gro" | "mol2" | "poscar"
> {
  return describeFormat(format).streaming !== "eager-only";
}

/**
 * Whether the given format ONLY supports streaming and has no eager
 * fallback. Hosts must reject the eager path for these formats with a
 * clear error rather than silently failing.
 */
export function isStreamingOnly(format: FileFormat): boolean {
  return describeFormat(format).streaming === "streaming-only";
}

/** Structure (one frame, no index) vs trajectory (N frames + index). */
export function ingestKind(format: FileFormat): IngestKind {
  return describeFormat(format).ingest;
}

function formatByteSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function wholeFileTrajectoryReason(
  format: FileFormat,
  byteLength: number,
): string {
  const label = describeFormat(format).label;
  const size = formatByteSize(byteLength);
  return `Cannot load ${size} trajectory (${label}) as one buffer. This host would copy the whole file into memory.`;
}

/**
 * Host-agnostic ingest router. Structures always open as one frame.
 * Streamable trajectories at/above {@link STREAMING_FILE_THRESHOLD_BYTES}
 * take `"stream"` when the host can range-read. Pass `hostCanRange: false`
 * (VS Code today) so a stream decision that still copies the whole file
 * is refused at {@link TRAJECTORY_WHOLE_FILE_CAP_BYTES}.
 */
export function decideIngest(
  format: FileFormat,
  byteLength: number,
  opts?: { hostCanRange?: boolean },
): IngestDecision {
  if (ingestKind(format) === "structure") {
    return { path: "whole-file" };
  }
  if (canStream(format) && byteLength >= STREAMING_FILE_THRESHOLD_BYTES) {
    if (
      opts?.hostCanRange === false &&
      byteLength >= TRAJECTORY_WHOLE_FILE_CAP_BYTES
    ) {
      return {
        path: "refuse",
        reason: `${wholeFileTrajectoryReason(format, byteLength)} Range open is not available yet.`,
      };
    }
    return { path: "stream" };
  }
  if (byteLength >= TRAJECTORY_WHOLE_FILE_CAP_BYTES) {
    return {
      path: "refuse",
      reason: wholeFileTrajectoryReason(format, byteLength),
    };
  }
  return { path: "whole-file" };
}
