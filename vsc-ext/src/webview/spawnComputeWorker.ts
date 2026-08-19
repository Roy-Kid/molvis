/**
 * VS Code webview replacement for stage's `compute/spawn`.
 *
 * Wired via `NormalModuleReplacementPlugin` in the webview rslib configs so
 * the main-thread graph never folds the compute worker into splitChunks
 * (dual chunk ownership). The worker is a separate rslib entry
 * (`rslib.webview.worker.config.mts` → `out/chunks/compute-worker.js`),
 * colocated with the shared chunks.
 */

import { spawnWebviewWorkerFromHref } from "./spawnWebviewWorker";

export function spawnComputeWorker(): Worker {
  // Non-literal path: bundlers must not treat this as a worker entry to fold
  // into the main graph. Resolves relative to this module's chunk URL
  // (`…/chunks/*.js` → `…/chunks/compute-worker.js`).
  const workerScript = "./compute-worker.js";
  return spawnWebviewWorkerFromHref(
    new URL(workerScript, import.meta.url).href,
    "molvis-compute",
  );
}
