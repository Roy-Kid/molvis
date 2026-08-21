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
  test("binary DCD/TRR/XTC are a native custom editor, no manual handoff", () => {
    const src = readFileSync(
      join(vscExtRoot(), "src/extension/panels/binaryEditorProvider.ts"),
      "utf8",
    );
    assert.ok(
      src.includes("handleRangeMessage"),
      "binary custom editor must call handleRangeMessage or DCD/XTC/TRR open hangs",
    );
    assert.ok(
      src.includes("webviewPanel.webview.html"),
      "binary custom editor must paint into the webview panel VS Code provides",
    );
    assert.ok(
      !src.includes("webviewPanel.dispose"),
      "never dispose the resolved panel: it races VS Code's editor open and throws 'OverlayWebview has been disposed'",
    );
    assert.ok(
      !src.includes("openQuickViewPanel"),
      "binary files open in the native custom editor, not a hand-off panel",
    );
  });

  test("Quick look panel answers readRange for binary trajectories", () => {
    const src = readFileSync(
      join(vscExtRoot(), "src/extension/panels/previewPanel.ts"),
      "utf8",
    );
    assert.ok(
      src.includes("handleRangeMessage"),
      "Quick look must call handleRangeMessage or DCD/XTC/TRR open hangs",
    );
  });

  test("stage drop onto a loaded scene augments instead of replacing", () => {
    const src = readFileSync(
      join(vscExtRoot(), "src/webview/attachStageHost.ts"),
      "utf8",
    );
    assert.ok(
      src.includes("dropLoadMode"),
      "drop must stack topology + trajectory instead of wiping the first file",
    );
    assert.ok(
      src.includes("mode"),
      "dropUri must forward LoadMode so the host does not default to replace",
    );
  });

  test("webview CSP connect-src allows blob: (worker wasm must not fetch)", () => {
    const src = readFileSync(
      join(vscExtRoot(), "src/extension/panels/html.ts"),
      "utf8",
    );
    assert.match(
      src,
      /connect-src \$\{webview\.cspSource\} https: blob:/,
      "connect-src must include blob: so leftover worker blob fetches are not a CSP 400",
    );
    assert.ok(
      src.includes('WEBVIEW_ASSET_REV = "wrap-atoms-10"'),
      "bump WEBVIEW_ASSET_REV when webview worker bootstrap changes",
    );
  });
});
