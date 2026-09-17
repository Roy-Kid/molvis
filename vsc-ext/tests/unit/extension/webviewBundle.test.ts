/**
 * Webview bundle checks — assert on the built `out/` tree, not on sources.
 *
 * Both failures these cover were invisible to typecheck and lint: a stylesheet
 * link with no file behind it, and an ESM library build emitting a bare
 * `import logo from "….png"`, which a browser refuses to execute as a module
 * script and which therefore took the whole page chunk down with it.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as assert from "assert";

function vscExtRoot(): string {
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json")) && dir.endsWith("vsc-ext")) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(`could not locate vsc-ext root from ${__dirname}`);
}

const root = vscExtRoot();
const outDir = join(root, "out");

/**
 * Every emitted JS file: the entries, their chunks, and the dynamic chunks
 * that land at the root of `out/` (`controller.js`, `page-bootstrap.js`).
 */
function bundleFiles(): string[] {
  const files: string[] = [];
  for (const sub of ["", "page", "webview", "sketch", "chunks"]) {
    const dir = sub ? join(outDir, sub) : outDir;
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".js")) files.push(join(dir, name));
    }
  }
  return files;
}

suite("webview bundles", () => {
  test("every asset html.ts links is actually emitted", () => {
    const src = readFileSync(
      join(root, "src/extension/panels/html.ts"),
      "utf8",
    );
    const refs = [
      ...src.matchAll(/scriptUri\(\s*webview,\s*extensionUri,([^)]*)\)/g),
    ].map((match) =>
      [...match[1].matchAll(/"([^"]+)"/g)].map((segment) => segment[1]),
    );
    assert.ok(refs.length > 0, "html.ts must reference webview assets");
    for (const segments of refs) {
      const asset = join(outDir, ...segments);
      assert.ok(
        existsSync(asset),
        `html.ts links out/${segments.join("/")}, which the build does not emit`,
      );
    }
  });

  test("the page entry stays small enough to paint before the shell loads", () => {
    const entry = join(outDir, "page/index.js");
    assert.ok(existsSync(entry), "out/page/index.js missing — run npm build");
    const bytes = readFileSync(entry).byteLength;
    assert.ok(
      bytes < 64 * 1024,
      `page entry is ${bytes} B: the shell must stay behind a dynamic import, or the tab is blank until ~10 MB of JS parses`,
    );
  });

  test("no bundle imports an asset as a module script", () => {
    const files = bundleFiles();
    assert.ok(files.length > 0, "no webview bundles found — run npm run build");
    const assetImport =
      /import\s+[\w$]+\s*from\s*["'][^"']+\.(?:png|jpe?g|gif|webp|svg|woff2?|ttf|eot)["']/;
    for (const file of files) {
      const match = readFileSync(file, "utf8").match(assetImport);
      assert.strictEqual(
        match,
        null,
        `${file.slice(root.length + 1)} imports an asset as a module (${match?.[0]}) — a browser rejects it for its MIME type and the whole chunk fails to execute`,
      );
    }
  });
});
