/**
 * Spawn the colocated compute worker.
 *
 * The URL pattern is the rsbuild / rspack-supported
 * `new Worker(new URL(..., import.meta.url))` form, so any host that bundles
 * this package (page rsbuild, python-served dist) folds `worker.js` into its
 * own build as a worker chunk — same pattern as
 * `transport/trajectory_worker/runtime.ts`.
 *
 * The reference is `./worker.js`, not `./worker.ts`: rslib builds this
 * package bundleless, transpiling `worker.ts` → `worker.js` while leaving the
 * URL string verbatim, so the published dist resolves to the emitted file.
 *
 * Hosts that build the worker separately (VS Code webview) swap this module
 * via `NormalModuleReplacementPlugin` — keep it single-purpose.
 */
export function spawnComputeWorker(): Worker {
  // Module worker. This chunk pulls shared split chunks, so the folding
  // host MUST emit ESM with `import`-based worker chunk loading: the page
  // sets `output.module: true` (rsbuild), the stage viewer bundle sets
  // `workerChunkLoading: "import"` (rslib is already ESM), and the repo
  // `.browserslistrc` keeps the browser floor module-worker-capable.
  // Under legacy `importScripts` loading a module worker dies at boot.
  //
  // The `new Worker(new URL(…))` form must stay literal here — rspack only
  // folds worker chunks when it sees that static expression in this file.
  // VS Code webviews replace this whole module via `NormalModuleReplacementPlugin`.
  return new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
    name: "molvis-compute",
  });
}
