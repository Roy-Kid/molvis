/**
 * VS Code webviews run at `vscode-webview://…`. Scripts rewritten by
 * `asWebviewUri` live on `*.vscode-cdn.net`.
 *
 * Two Chromium traps:
 *
 * 1. `new Worker(cdnUrl)` is a cross-origin constructor and is rejected.
 * 2. A blob-module `import` of the real worker script loads JS, but the
 *    worker's subsequent `fetch(…module.wasm)` is a CORS request from
 *    `vscode-webview://` and never completes. The worker never posts
 *    `worker-heartbeat`, so trajectory `open()` hangs at 0/0….
 *
 * Fix: fetch the worker script **and** its wasm on the main thread
 * (document `fetch` of `asWebviewUri` works), rewrite wasm `fetch` to a
 * same-origin `blob:` URL, then spawn a blob worker from that source.
 *
 * `worker-src` must allow `blob:` (see `html.ts`).
 */

/** rspack async-wasm loader: `r.v(exports, id, "<contenthash>", …)`. */
const WASM_LOADER_HASH = /\.v\([^,]+,[^,]+,"([a-f0-9]+)"/;

export function webviewWorkerBootstrap(scriptHref: string): string {
  return `import ${JSON.stringify(scriptHref)};\n`;
}

/** Resolve `out/static/wasm/<10-char>.module.wasm` next to `chunks/worker.js`. */
export function wasmHrefFromWorkerScript(
  scriptHref: string,
  scriptText: string,
): string | null {
  const match = scriptText.match(WASM_LOADER_HASH);
  if (!match) return null;
  return new URL(
    `../static/wasm/${match[1].slice(0, 10)}.module.wasm`,
    scriptHref,
  ).href;
}

/** Prefix that redirects `.module.wasm` fetches to a main-thread blob. */
export function webviewWorkerWithMainThreadWasm(
  scriptText: string,
  wasmBlobUrl: string,
): string {
  return (
    `globalThis.fetch=((orig)=>function(input,init){` +
    `const url=typeof input==="string"?input:input instanceof Request?input.url:String(input);` +
    `if(typeof url==="string"&&url.includes(".module.wasm"))return orig(${JSON.stringify(wasmBlobUrl)},init);` +
    `return orig(input,init);` +
    `})(globalThis.fetch);\n` +
    scriptText
  );
}

export function spawnWebviewWorkerFromHref(
  scriptHref: string,
  name: string,
): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Worker is not available");
  }
  const blobUrl = URL.createObjectURL(
    new Blob([webviewWorkerBootstrap(scriptHref)], { type: "text/javascript" }),
  );
  return new Worker(blobUrl, { type: "module", name });
}

/** Trajectory worker: main-thread wasm fetch, then blob spawn. */
export async function spawnWebviewWorkerLoadingWasm(
  scriptHref: string,
  name: string,
): Promise<Worker> {
  if (typeof Worker === "undefined") {
    throw new Error("Worker is not available");
  }
  const scriptRes = await fetch(scriptHref);
  if (!scriptRes.ok) {
    throw new Error(`Failed to load worker script (${scriptRes.status})`);
  }
  const scriptText = await scriptRes.text();
  const wasmHref = wasmHrefFromWorkerScript(scriptHref, scriptText);
  if (!wasmHref) {
    return spawnWebviewWorkerFromHref(scriptHref, name);
  }
  const wasmRes = await fetch(wasmHref);
  if (!wasmRes.ok) {
    throw new Error(`Failed to load worker wasm (${wasmRes.status})`);
  }
  const wasmBlob = URL.createObjectURL(
    new Blob([await wasmRes.arrayBuffer()], { type: "application/wasm" }),
  );
  const blobUrl = URL.createObjectURL(
    new Blob([webviewWorkerWithMainThreadWasm(scriptText, wasmBlob)], {
      type: "text/javascript",
    }),
  );
  return new Worker(blobUrl, { type: "module", name });
}
