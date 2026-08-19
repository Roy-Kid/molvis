/**
 * Contract lock: trajectory streaming constructors live in MolRS.
 *
 * Text streams (dump/xyz/pdb/sdf/lammps-data) must be exported.
 * DCD / XTC / TRR must expose the same stream surface — until molrs
 * ships them this script is red. That is the bar (traj-ingest-00-molrs),
 * not a skip.
 *
 * Reads `molrs.d.ts` as text so Node does not instantiate WASM.
 *
 * Run: `node regressions/traj-ingest-00-molrs.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dts = readFileSync(require.resolve("@molcrafts/molrs/molrs.d.ts"), "utf8");

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const textStreams = [
  "WasmLammpsDumpStream",
  "WasmXyzStream",
  "WasmPdbStream",
  "WasmSdfStream",
  "WasmLammpsDataStream",
] as const;

for (const name of textStreams) {
  assert(
    dts.includes(`export class ${name}`),
    `molrs.d.ts missing text stream ${name}`,
  );
}

const binaryStreams = ["WasmDcdStream", "WasmXtcStream", "WasmTrrStream"] as const;
const missing = binaryStreams.filter(
  (name) => !dts.includes(`export class ${name}`),
);
assert(
  missing.length === 0,
  `molrs.d.ts missing binary stream(s): ${missing.join(", ")} — DCD/XTC/TRR must share the feedIndexChunk + parseRangeInInput surface`,
);

const here = dirname(fileURLToPath(import.meta.url));
const vscSrc = join(here, "../vsc-ext/src");
const vscText = readFileSync(join(vscSrc, "extension/loading/molecularFileLoader.ts"), "utf8");
assert(
  !vscText.includes("ITEM: TIMESTEP"),
  "vsc-ext MolecularFileLoader must not scan ITEM: TIMESTEP",
);

console.log("traj-ingest-00-molrs ok");
