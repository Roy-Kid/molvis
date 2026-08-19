/**
 * Binary custom editors (VS Code Preview of .dcd/.xtc/.trr) must answer
 * webview `readRange` — otherwise the streaming worker hangs and the
 * canvas stays on the empty boot trajectory.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as assert from "assert";

function vscExtRoot(): string {
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    if (dir.endsWith("vsc-ext")) return dir;
    dir = dirname(dir);
  }
  throw new Error(`could not locate vsc-ext from ${__dirname}`);
}

suite("binary custom editor range", () => {
  test("binaryEditorProvider forwards readRange to the host reader", () => {
    const src = readFileSync(
      join(vscExtRoot(), "src/extension/panels/binaryEditorProvider.ts"),
      "utf8",
    );
    assert.ok(
      src.includes("handleRangeMessage"),
      "binary preview must call handleRangeMessage or DCD/XTC/TRR open hangs",
    );
  });
});
