/**
 * Contract lock: .molidx v2 is a MolRS FrameIndexEntry cache, not a format.
 *
 * Run: `node regressions/traj-ingest-02-sidecar.ts`
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decideMolidxUse,
  decodeMolidx,
  encodeMolidx,
  MOLIDX_VERSION,
} from "../stage/src/io/cache/molidx_codec.ts";

const require = createRequire(import.meta.url);

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const encoded = encodeMolidx({
  format: "xyz",
  fileSize: 4096,
  entries: [
    { byteOffset: 0, byteLen: 2048 },
    { byteOffset: 2048, byteLen: 2048 },
  ],
});
assert(
  new DataView(encoded).getUint32(4, true) === 2,
  "encode writes version 2",
);
assert(MOLIDX_VERSION === 2, "MOLIDX_VERSION is 2");

const decoded = decodeMolidx(encoded);
assert(decoded?.complete === true, "complete default");
assert(decoded?.fileSize === 4096, "fileSize 4096");
assert(decoded?.entries.length === 2, "two frames");

const bad = encoded.slice(0);
new DataView(bad).setUint32(4, 99, true);
assert(decodeMolidx(bad) === null, "version 99 is a miss");

const incomplete = decodeMolidx(
  encodeMolidx({
    format: "xyz",
    fileSize: 4096,
    complete: false,
    entries: [
      { byteOffset: 0, byteLen: 1024 },
      { byteOffset: 1024, byteLen: 1024 },
    ],
  }),
);
const use = decideMolidxUse(incomplete, 4096, "xyz");
assert(use.action === "resume", "incomplete is resume, not hit");
if (use.action === "resume") {
  assert(use.scannedBytes === 2048, "resume scannedBytes is last frame end");
}

const here = dirname(fileURLToPath(import.meta.url));
const codecSrc = readFileSync(
  join(here, "../stage/src/io/cache/molidx_codec.ts"),
  "utf8",
);
assert(codecSrc.includes("decideMolidxUse"), "codec exports decideMolidxUse");
assert(
  !codecSrc.includes("OpfsBlobCache.set"),
  "codec must not copy the source file",
);

void require;

console.log("traj-ingest-02-sidecar ok");
