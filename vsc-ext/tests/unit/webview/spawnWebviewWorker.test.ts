import * as assert from "assert";
import {
  waitForWasmWant,
  wasmHrefFromWorkerScript,
  webviewWorkerBootstrap,
  webviewWorkerWithPostedWasm,
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

  test("posted-wasm prefix inlines the worker and never import()s a CDN URL", () => {
    const body = webviewWorkerWithPostedWasm("/* worker-body */");
    assert.ok(body.includes("__molvisWasmWant"));
    assert.ok(body.includes("__molvisWasm"));
    assert.ok(body.includes(".module.wasm"));
    assert.ok(body.includes("new Response"));
    assert.ok(body.includes("application/wasm"));
    assert.ok(body.endsWith("/* worker-body */"));
    assert.ok(!body.includes("await import("));
    assert.ok(!body.includes("vscode-cdn.net"));
    assert.ok(!body.includes("createObjectURL"));
    assert.doesNotMatch(
      body,
      /origFetch\([^)]*\.module\.wasm/,
      "wasm must not fall through to fetch",
    );
  });

  test("waitForWasmWant resolves on the prefix handshake flag", async () => {
    const listeners = new Map<string, Set<(event: Event) => void>>();
    const worker = {
      addEventListener(type: string, listener: (event: Event) => void) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener(type: string, listener: (event: Event) => void) {
        listeners.get(type)?.delete(listener);
      },
    };
    const pending = waitForWasmWant(worker, 200);
    for (const listener of listeners.get("message") ?? []) {
      listener({ data: { __molvisWasmWant: true } } as MessageEvent);
    }
    await pending;
  });
});
