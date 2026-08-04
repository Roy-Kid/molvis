#!/usr/bin/env node
/**
 * VENDORED FILE — do not edit. Source: molvis `scripts/vendored/`.
 *
 * Verifies that this repo's copy of the MolVis plugin contract still matches
 * what was vendored, using the hashes in `src/types/contract.lock.json`.
 * Runs offline: it does not need a molvis checkout alongside.
 *
 * A failure means someone hand-edited a vendored file. That is how the three
 * previous copies of the contract silently drifted apart. Make the change in
 * the molvis monorepo and re-run `npm run sync:plugin-contract` there.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(packageRoot, "src/types/contract.lock.json");

if (!existsSync(lockPath)) {
  console.error(
    "src/types/contract.lock.json is missing — run sync:plugin-contract from the molvis repo.",
  );
  process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
let bad = 0;

for (const [file, expected] of Object.entries(lock.files)) {
  const path = join(packageRoot, file);
  if (!existsSync(path)) {
    console.error(`  MISSING ${file}`);
    bad += 1;
    continue;
  }
  const actual = createHash("sha256")
    .update(readFileSync(path, "utf8"))
    .digest("hex")
    .slice(0, 12);
  if (actual !== expected) {
    console.error(`  EDITED  ${file} (${actual} != vendored ${expected})`);
    bad += 1;
  } else {
    console.log(`  ok      ${file}`);
  }
}

if (bad > 0) {
  console.error(
    `\n${bad} vendored file(s) diverged from the MolVis plugin contract.\n` +
      "Edit page/src/plugins/contract.ts in the molvis monorepo and re-run\n" +
      "`npm run sync:plugin-contract` there — never patch the copy.",
  );
  process.exit(1);
}
console.log(
  `vendored contract intact (${lock.contractVersion ?? "unversioned"})`,
);
