/**
 * Contract lock: DataSource has no kind; snapshots do not write DataSourceKind.
 *
 * Run: `node regressions/traj-ingest-06-source.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const here = dirname(fileURLToPath(import.meta.url));
const ds = readFileSync(
  join(here, "../stage/src/pipeline/data_source.ts"),
  "utf8",
);
assert(!ds.includes("DataSourceKind"), "DataSourceKind is gone");
assert(!/\breadonly kind\b/.test(ds), "DataSource has no kind field");

const serialize = readFileSync(
  join(here, "../stage/src/project/serialize.ts"),
  "utf8",
);
assert(!serialize.includes("kind: ds.kind"), "snapshot does not write ds.kind");
assert(serialize.includes("typeName"), "snapshot writes constructor typeName");

const types = readFileSync(join(here, "../stage/src/project/types.ts"), "utf8");
assert(
  !types.includes("DataSourceKind"),
  "project payload has no DataSourceKind",
);

console.log("traj-ingest-06-source ok");
