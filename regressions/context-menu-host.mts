/**
 * Regression: ContextMenuHost lifecycle contract.
 *
 * Host is not a package export and requires a browser DOM (custom elements +
 * shadow roots). This driver runs the binding unit suite under core's rstest
 * Chromium config — the same assertions as AC-005/AC-006 (registry exclusivity,
 * outside click, ignoreCloseTargets, Escape, button auto-hide, showContextMenu
 * gate, resolve forwarding).
 *
 * Run from repo root:
 *   npx tsx regressions/context-menu-host.mts
 *
 * Exit 0 on pass; non-zero on failure.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(root, "core");

const result = spawnSync(
  "npx",
  ["rstest", "run", "tests/context_menu_host.test.ts"],
  {
    cwd: coreDir,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error("regressions/context-menu-host.mts: FAIL", result.error);
  process.exit(1);
}

const code = result.status ?? 1;
if (code === 0) {
  console.log("regressions/context-menu-host.mts: OK");
}
process.exit(code);
