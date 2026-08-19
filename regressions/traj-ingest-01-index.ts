/**
 * Public-API lock for Trajectory three-component index.
 * Numeric goldens live in stage/tests/system/trajectory.test.ts (need WASM
 * Frame). This script only source-locks the compiled public surface so
 * `node regressions/traj-ingest-01-index.ts` does not instantiate molrs WASM.
 *
 * Run after `npm run build:stage`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const traj = readFileSync(
  join(root, "stage/dist/system/trajectory.js"),
  "utf8",
);
const ds = readFileSync(
  join(root, "stage/dist/pipeline/data_source.js"),
  "utf8",
);

for (const token of [
  "recordIndexedLength",
  "markIndexComplete",
  "requireCompleteLength",
  "indexedLength",
  "indexComplete",
]) {
  assert(traj.includes(token), `trajectory.js missing ${token}`);
}

assert(
  ds.includes("indexedLength"),
  "FileDataSource must read indexedLength for frameCount",
);

const io = readFileSync(join(root, "stage/src/io/index.ts"), "utf8");
assert(
  io.includes("length-changed"),
  "loadFileStream must emit length-changed",
);
assert(
  io.includes("index-complete"),
  "loadFileStream must emit index-complete",
);
const ev = readFileSync(join(root, "stage/src/events.ts"), "utf8");
assert(
  ev.includes('"length-changed"'),
  "MolvisEventMap missing length-changed",
);
assert(
  ev.includes('"index-complete"'),
  "MolvisEventMap missing index-complete",
);

console.log("traj-ingest-01-index ok");
