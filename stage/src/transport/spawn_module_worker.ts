/**
 * Spawn a `type: "module"` worker from `scriptUrl`.
 *
 * Same-origin constructors succeed (page, python-served dist). VS Code
 * webviews run at `vscode-webview://…` while `asWebviewUri` scripts live on
 * `*.vscode-cdn.net`; Chromium then throws
 * `Failed to construct 'Worker': Script at '…' cannot be accessed from origin`.
 * In that case bootstrap a `blob:` module that `import`s the real URL so the
 * worker's `import.meta.url` (and rspack publicPath / wasm) stay on the CDN.
 */
export function spawnModuleWorker(scriptUrl: URL, name: string): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Worker is not available");
  }
  try {
    return new Worker(scriptUrl, { type: "module", name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("cannot be accessed from origin")) {
      throw err;
    }
    const blobUrl = URL.createObjectURL(
      new Blob([`import ${JSON.stringify(scriptUrl.href)};\n`], {
        type: "text/javascript",
      }),
    );
    return new Worker(blobUrl, { type: "module", name });
  }
}
