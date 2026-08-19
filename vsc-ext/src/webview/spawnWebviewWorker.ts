/**
 * VS Code webviews run at `vscode-webview://…`. Scripts rewritten by
 * `asWebviewUri` live on `*.vscode-cdn.net`. `new Worker(cdnUrl)` is a
 * cross-origin constructor and Chromium rejects it:
 *
 *   Failed to construct 'Worker': Script at 'https://…vscode-cdn.net/…/worker.js'
 *   cannot be accessed from origin 'vscode-webview://…'
 *
 * Bootstrap a same-origin `blob:` module whose body is a single `import` of
 * the real script. The imported module keeps `import.meta.url` on the CDN, so
 * rspack's auto publicPath still finds `static/wasm/`.
 *
 * `worker-src` must allow `blob:` (see `html.ts`).
 */

export function webviewWorkerBootstrap(scriptHref: string): string {
  return `import ${JSON.stringify(scriptHref)};\n`;
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
