import * as assert from "assert";
import { renderMountInject } from "../../src/extension/panels/mountInject";

suite("renderMountInject", () => {
  test("seeds the surface a panel asks for", () => {
    const html = renderMountInject("N0NCE", { surface: "canvas" });
    assert.match(html, /nonce="N0NCE"/);
    assert.match(html, /__MOLVIS_VSCODE_INIT__/);
    assert.match(html, /"surface":"canvas"/);
  });

  test("emits nothing when a caller asks for nothing", () => {
    // Otherwise the global would quietly become mandatory for every page
    // surface, and a panel that never opted in would inherit one.
    assert.strictEqual(renderMountInject("N0NCE", undefined), "");
    assert.strictEqual(renderMountInject("N0NCE", {}), "");
  });

  test("merges rather than assigns", () => {
    // Other hosts put `config` / `settings` on the same global; a bare
    // assignment would drop them.
    assert.match(
      renderMountInject("N0NCE", { surface: "full" }),
      /Object\.assign\(window\.__MOLVIS_VSCODE_INIT__ \|\| \{\}/,
    );
  });
});
