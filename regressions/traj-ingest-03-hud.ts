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
assert(scanning.filmstripVisible === true, "scanning filmstrip visible");
const first = new TrajectoryExtent({
  length: null,
  indexedLength: 1,
  indexComplete: false,
});
assert(first.filmstripVisible === true, "scanning 1-frame filmstrip visible");
assert(first.frameReadout(0) === "1/1…", "readout 1/1…");

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
const appTsx = readFileSync(join(here, "../page/src/App.tsx"), "utf8");
assert(
  appTsx.includes("trajectoryExtent.filmstripVisible"),
  "page timeline visibility follows filmstripVisible (scanning 1-frame)",
);
const panel = readFileSync(
  join(here, "../stage/src/ui/panels/trajectory_panel.ts"),
  "utf8",
);
assert(
  panel.includes("style.display"),
  "stage HUD sets display, not only the hidden attribute",
);
const io = readFileSync(join(here, "../stage/src/io/index.ts"), "utf8");
const loadFn = io.slice(io.indexOf("export async function loadFileStream"));
const emitAt = loadFn.indexOf("indexComplete: false");
const spawnAt = loadFn.indexOf("spawnTrajectoryWorker(format)");
assert(
  emitAt >= 0 && spawnAt >= 0 && emitAt < spawnAt,
  "loadFileStream must emit scanning HUD before spawning the worker",
);
const attach = readFileSync(
  join(here, "../vsc-ext/src/webview/attachStageHost.ts"),
  "utf8",
);
assert(
  /Opening \$\{message\.filename\}/.test(attach),
  "Preview openUri must announce Opening… so the HUD can appear immediately",
);
const ingest = readFileSync(join(here, "../stage/src/io/formats.ts"), "utf8");
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
  !/Indexed \$\{file\.name\}/.test(picker),
  "must not emit success Indexed before the scan finishes",
);

console.log("traj-ingest-03-hud ok");
