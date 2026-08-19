/**
 * Contract lock: VS Code range open for streamable trajectories.
 *
 * Run: `node regressions/traj-ingest-04-range.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideIngest } from "../stage/src/io/formats.ts";
import { decideMolecularLoadIntent } from "../vsc-ext/src/extension/loading/molecularLoadIntent.ts";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(
  JSON.stringify(
    decideIngest("lammps-dump", 536870912, { hostCanRange: true }),
  ) === JSON.stringify({ path: "stream" }),
  "512 MiB dump with hostCanRange streams",
);
assert(
  decideMolecularLoadIntent("lammps-dump", 536870912).action === "open-uri",
  "loader intent is open-uri",
);

const here = dirname(fileURLToPath(import.meta.url));
const loader = readFileSync(
  join(here, "../vsc-ext/src/extension/loading/molecularFileLoader.ts"),
  "utf8",
);
assert(
  loader.includes("hostCanRange: true") ||
    loader.includes("decideMolecularLoadIntent"),
  "loader uses range-capable ingest",
);
assert(
  !loader.includes("hostCanRange: false"),
  "loader must not pin hostCanRange false",
);

console.log("traj-ingest-04-range ok");
