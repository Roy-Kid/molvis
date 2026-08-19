/**
 * Contract lock: HUD extent readout and implicit-end gate.
 *
 * Run: `node regressions/traj-ingest-03-hud.ts`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TrajectoryExtent } from "../page/src/lib/trajectory-extent.ts";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const scanning = new TrajectoryExtent({
  length: null,
  indexedLength: 12,
  indexComplete: false,
});
assert(scanning.addressableLength === 12, "addressableLength 12");
assert(scanning.lastAddressableIndex === 11, "last index 11");
assert(scanning.frameReadout(2) === "3/12…", "readout 3/12…");
assert(scanning.implicitEndIndex() === null, "no implicit end while scanning");

const complete = new TrajectoryExtent({
  length: 40,
  indexedLength: 40,
  indexComplete: true,
});
assert(complete.frameReadout(2) === "3/40", "complete readout 3/40");
assert(complete.implicitEndIndex() === 39, "implicit end 39");

const here = dirname(fileURLToPath(import.meta.url));
const overlay = readFileSync(
  join(here, "../page/src/components/viewer/ViewerStatusOverlay.tsx"),
  "utf8",
);
assert(
  overlay.includes("ViewerStatusOverlay"),
  "status overlay still owns scanning copy",
);
const ingest = readFileSync(
  join(here, "../stage/src/io/formats.ts"),
  "utf8",
);
assert(ingest.includes("decideIngest"), "decideIngest stays the ingest router");
const picker = readFileSync(
  join(here, "../page/src/components/format-picker-dialog.tsx"),
  "utf8",
);
assert(
  picker.includes("frame(s) ready"),
  "stream open reports frame(s) ready, not Indexed success",
);
assert(
  !picker.includes("`Indexed ${file.name}`") &&
    !picker.includes("Indexed ${file.name}"),
  "must not emit success Indexed before the scan finishes",
);

console.log("traj-ingest-03-hud ok");
