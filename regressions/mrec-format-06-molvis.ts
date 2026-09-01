/**
 * Public-API pin for mrec-format-06-molvis (2026-08-30).
 *
 * FileFormat stays the pre-mrec union — hosts match `*.mrec` without a
 * `"mrec"` format id. molvis does not grow a public FrameReader. loadZarrStore
 * constructs molrs TrajectoryReader.
 *
 * Hard-coded goldens; no network; no WASM init. Reads source text of the
 * published TypeScript / Python surfaces.
 *
 * Run: `node regressions/mrec-format-06-molvis.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function unionMembers(src: string, typeName: string): string[] {
  const match = src.match(
    new RegExp(`export type ${typeName}\\s*=([\\s\\S]*?);`),
  );
  if (!match) throw new Error(`no ${typeName} union`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** FileFormat members as of mrec-format-06-molvis; `"mrec"` is not one. */
const FILE_FORMAT_MEMBERS = [
  "pdb",
  "xyz",
  "cif",
  "lammps",
  "lammps-dump",
  "sdf",
  "dcd",
  "cube",
  "chgcar",
  "gro",
  "mol2",
  "poscar",
  "trr",
  "xtc",
];

const here = dirname(fileURLToPath(import.meta.url));

const formats = readFileSync(join(here, "../stage/src/io/formats.ts"), "utf8");
const formatMembers = unionMembers(formats, "FileFormat");
assert(
  JSON.stringify(formatMembers) === JSON.stringify(FILE_FORMAT_MEMBERS),
  `FileFormat members drifted: ${formatMembers.join(", ")}`,
);
assert(!formatMembers.includes("mrec"), 'FileFormat must not gain "mrec"');

const protocol = readFileSync(
  join(here, "../vsc-ext/src/protocol/messages.ts"),
  "utf8",
);
const protocolMembers = unionMembers(protocol, "FileFormat");
assert(
  JSON.stringify(protocolMembers) === JSON.stringify(FILE_FORMAT_MEMBERS),
  `vsc-ext FileFormat members drifted: ${protocolMembers.join(", ")}`,
);

const stageBarrel = readFileSync(join(here, "../stage/src/index.ts"), "utf8");
assert(
  !/\bFrameReader\b/.test(stageBarrel),
  "stage public barrel must not export FrameReader",
);

const ioBarrel = readFileSync(join(here, "../stage/src/io/index.ts"), "utf8");
assert(
  !/\bFrameReader\b/.test(ioBarrel),
  "stage/io public barrel must not export FrameReader",
);

const pyInit = readFileSync(
  join(here, "../python/src/molvis/__init__.py"),
  "utf8",
);
assert(
  !/\bFrameReader\b/.test(pyInit),
  "python molvis must not expose FrameReader",
);

// The store loader was renamed loadZarrStore -> loadMrecStore (mrec is the
// product, zarr the encoding). The invariant is unchanged: it constructs the
// molrs TrajectoryReader, never a RecordReader.
const zarr = readFileSync(join(here, "../stage/src/io/zarr.ts"), "utf8");
const loadStart = zarr.indexOf("export function loadMrecStore");
assert(loadStart >= 0, "loadMrecStore missing");
const loadRest = zarr.slice(loadStart);
const loadNext = loadRest.indexOf("\nexport ", 1);
const loadMrecStore = loadNext >= 0 ? loadRest.slice(0, loadNext) : loadRest;
assert(
  loadMrecStore.includes("new TrajectoryReader"),
  "loadMrecStore must construct TrajectoryReader",
);
assert(
  !loadMrecStore.includes("new RecordReader"),
  "loadMrecStore must not construct RecordReader",
);
// The old name stays as a deprecation alias for one window so
// `@molcrafts/molvis-stage/io` remains non-breaking.
assert(
  /\bloadZarrStore\b/.test(zarr),
  "loadZarrStore deprecation alias must remain",
);

console.log("mrec-format-06-molvis ok");
