/**
 * Webview alias target for `@molcrafts/molvis-stage/worker-spawner`.
 *
 * Both webview rslib configs (`rslib.webview.config.mts`,
 * `rslib.webview.page.config.mts`) map the stage subpath onto this module
 * via an exact-match `resolve.alias` entry — replacing the retired
 * `NormalModuleReplacementPlugin` rewrites — so the main-thread graph never
 * folds the engine workers into splitChunks (dual chunk ownership is what
 * produced null module exports on main). Signatures are seam-identical to
 * stage's `worker_spawner.ts`; the workers themselves are separate rslib
 * entries (`rslib.webview.worker.config.mts` → `out/chunks/worker.js` +
 * `out/chunks/compute-worker.js`), colocated with `chunks/shared.js`.
 *
 * Internally both spawns still ride the two existing blob bootstrap paths
 * in `./spawnWebviewWorker`; their convergence belongs to
 * worker-arch-unify-04-bootstrap.
 *
 * Types/runtime resolve from `@molcrafts/molvis-stage` package exports →
 * dist (the 02-frozen `./trajectory-runtime` / `./trajectory-protocol`
 * surfaces).
 */

import type { Format } from "@molcrafts/molvis-stage/trajectory-protocol";
import {
  TrajectoryRuntime,
  type WorkerLike,
} from "@molcrafts/molvis-stage/trajectory-runtime";
import {
  spawnWebviewWorkerFromHref,
  spawnWebviewWorkerLoadingWasm,
} from "./spawnWebviewWorker";

export async function spawnTrajectoryWorker(
  format: Format,
): Promise<TrajectoryRuntime> {
  // Non-literal path: bundlers must not treat this as a worker entry to fold
  // into the main graph. Resolves relative to this module's chunk URL
  // (`…/chunks/shared.js` → `…/chunks/worker.js`).
  const workerScript = "./worker.js";
  const worker = await spawnWebviewWorkerLoadingWasm(
    new URL(workerScript, import.meta.url).href,
    `trajectory-${format}`,
  );
  return new TrajectoryRuntime(worker as WorkerLike, format);
}

export async function spawnComputeWorker(): Promise<Worker> {
  // Non-literal path, same reasoning as above. Resolves relative to this
  // module's chunk URL (`…/chunks/*.js` → `…/chunks/compute-worker.js`).
  const workerScript = "./compute-worker.js";
  return spawnWebviewWorkerFromHref(
    new URL(workerScript, import.meta.url).href,
    "molvis-compute",
  );
}
