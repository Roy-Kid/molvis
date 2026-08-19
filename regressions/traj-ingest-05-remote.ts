/**
 * Contract lock: Remote index-near-data uses MolRS + .molidx, not a JS scanner.
 *
 * Run: `node regressions/traj-ingest-05-remote.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideIngest } from "../stage/src/io/formats.ts";
import {
  decodeMolidx,
  encodeMolidx,
} from "../stage/src/io/cache/molidx_codec.ts";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const twoHundredGiB = 200 * 1024 * 1024 * 1024;
assert(
  JSON.stringify(
    decideIngest("lammps-dump", twoHundredGiB, { hostCanRange: true }),
  ) === JSON.stringify({ path: "stream" }),
  "200 GiB dump with hostCanRange streams",
);

const encoded = encodeMolidx({
  format: "xyz",
  fileSize: 32,
  entries: [{ byteOffset: 0, byteLen: 32 }],
});
assert(decodeMolidx(encoded)?.format === "xyz", "v2 codec round-trips");

const here = dirname(fileURLToPath(import.meta.url));
const indexer = readFileSync(
  join(here, "../vsc-ext/src/extension/loading/remoteMolrsIndexer.ts"),
  "utf8",
);
assert(!indexer.includes("ITEM: TIMESTEP"), "no JS dump scanner in EH indexer");
const store = readFileSync(
  join(here, "../vsc-ext/src/extension/loading/remoteIndexStore.ts"),
  "utf8",
);
assert(store.includes(".molidx"), "sibling name uses .molidx");

console.log("traj-ingest-05-remote ok");
