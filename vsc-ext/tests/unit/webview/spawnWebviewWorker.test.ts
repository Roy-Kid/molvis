import * as assert from "assert";
import {
  wasmHrefFromWorkerScript,
  webviewWorkerBootstrap,
  webviewWorkerWithMainThreadWasm,
} from "../../../src/webview/spawnWebviewWorker";

suite("spawnWebviewWorker", () => {
  test("bootstrap is a module import of the real script href", () => {
    const href = "https://vscode-cdn.net/home/ext/out/chunks/worker.js";
    assert.strictEqual(
      webviewWorkerBootstrap(href),
      `import "https://vscode-cdn.net/home/ext/out/chunks/worker.js";\n`,
    );
  });

  test("resolves wasm href from the rspack loader hash", () => {
    const script =
      't.exports=r.v(e,t.id,"3664ff725839662e",{"./molrs_bg.js":{}})';
    const href = wasmHrefFromWorkerScript(
      "https://cdn.example/out/chunks/worker.js",
      script,
    );
    assert.strictEqual(
      href,
      "https://cdn.example/out/static/wasm/3664ff7258.module.wasm",
    );
  });

  test("wasm fetch interceptor rewrites .module.wasm to the blob URL", () => {
    const body = webviewWorkerWithMainThreadWasm(
      "/* worker */",
      "blob:vscode-webview://wasm",
    );
    assert.ok(body.includes(".module.wasm"));
    assert.ok(body.includes("blob:vscode-webview://wasm"));
    assert.ok(body.endsWith("/* worker */"));
  });
});
