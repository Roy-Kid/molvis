/**
 * VS Code webviews run at `vscode-webview://…`. Scripts rewritten by
 * `asWebviewUri` live on `*.vscode-cdn.net`.
 *
 * Chromium traps, in the order we hit them:
 *
 * 1. `new Worker(cdnUrl)` is a cross-origin constructor and is rejected.
 * 2. A blob-module **static** `import` of the CDN worker script loads JS
 *    (imports are not `fetch`), but then `fetch(…module.wasm)` from the
 *    worker is CORS / CSP `connect-src` and throws `Failed to fetch`.
 *    Redirecting that fetch to a `blob:` wasm URL still fetches.
 * 3. A blob-module **dynamic** `import(cdnUrl)` *is* a fetch, and throws
 *    `Failed to fetch dynamically imported module`. Static `import` is
 *    hoisted, so it cannot run after a wasm handshake.
 *
 * Fix: fetch worker.js **and** wasm on the main thread (document `fetch`
 * of `asWebviewUri` works). Spawn a blob worker whose prefix waits for
 * `{__molvisWasm: ArrayBuffer}`, patches `fetch` / `instantiateStreaming`
 * to serve those bytes, then **inlines** the worker source in the same
 * module — no worker-side import, no worker-side fetch.
 *
 * Chrome module workers drop messages posted before the worker script
 * starts, so the prefix asks for the bytes (`__molvisWasmWant`) first.
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

/**
 * Handshake + in-memory wasm, then the real worker source.
 *
 * `scriptText` is appended in the same module so we never `import()` a
 * CDN URL from the blob worker. The bundled worker has no static imports.
 */
export function webviewWorkerWithPostedWasm(scriptText: string): string {
  return (
    `const wasmBuf=await new Promise((resolve,reject)=>{` +
    `const t=setTimeout(()=>reject(new Error("timed out waiting for wasm bytes")),30000);` +
    `addEventListener("message",function onMsg(ev){` +
    `const d=ev.data;` +
    `if(d&&d.__molvisWasm instanceof ArrayBuffer){` +
    `clearTimeout(t);removeEventListener("message",onMsg);resolve(d.__molvisWasm);` +
    `}});` +
    `postMessage({__molvisWasmWant:true});` +
    `});` +
    `const origFetch=globalThis.fetch.bind(globalThis);` +
    `globalThis.fetch=function(input,init){` +
    `const url=typeof input==="string"?input:input instanceof Request?input.url:String(input);` +
    `if(typeof url==="string"&&url.includes(".module.wasm")){` +
    `return Promise.resolve(new Response(wasmBuf.slice(0),{status:200,headers:{"Content-Type":"application/wasm"}}));` +
    `}` +
    `return origFetch(input,init);` +
    `};` +
    `try{WebAssembly.instantiateStreaming=function(_s,imports){return WebAssembly.instantiate(wasmBuf.slice(0),imports)};}catch(_e){}` +
    `\n` +
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

/** Resolves when the blob prefix posts `{__molvisWasmWant: true}`. */
export function waitForWasmWant(
  worker: Pick<Worker, "addEventListener" | "removeEventListener">,
  timeoutMs = 15_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("worker did not request wasm bytes"));
    }, timeoutMs);
    const onMsg = (event: Event) => {
      const data = (event as MessageEvent).data as {
        __molvisWasmWant?: unknown;
      };
      if (data && data.__molvisWasmWant === true) {
        cleanup();
        resolve();
      }
    };
    const onErr = (event: Event) => {
      const message =
        event instanceof ErrorEvent && event.message
          ? event.message
          : "worker error";
      cleanup();
      reject(new Error(message));
    };
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener("message", onMsg);
      worker.removeEventListener("error", onErr);
    };
    worker.addEventListener("message", onMsg);
    worker.addEventListener("error", onErr);
  });
}

/** Trajectory worker: main-thread wasm fetch, post bytes, inlined blob spawn. */
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
    throw new Error("Failed to locate worker wasm hash in script");
  }
  const wasmRes = await fetch(wasmHref);
  if (!wasmRes.ok) {
    throw new Error(`Failed to load worker wasm (${wasmRes.status})`);
  }
  const wasmBuf = await wasmRes.arrayBuffer();
  const blobUrl = URL.createObjectURL(
    new Blob([webviewWorkerWithPostedWasm(scriptText)], {
      type: "text/javascript",
    }),
  );
  const worker = new Worker(blobUrl, { type: "module", name });
  await waitForWasmWant(worker);
  worker.postMessage({ __molvisWasm: wasmBuf }, [wasmBuf]);
  return worker;
}
