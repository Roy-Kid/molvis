/**
 * VS Code webview replacement for core's `spawnTrajectoryWorker`.
 *
 * Wired via resolve.alias in `rslib.webview.config.mts` so the main-thread
 * graph never pulls `worker.ts` into splitChunks (dual chunk ownership).
 * The worker is a separate rslib entry emitted as `out/chunks/worker.js`,
 * colocated with `chunks/shared.js`.
 */

import type { Format } from "../../../stage/src/transport/trajectory_worker/protocol";
import {
  TrajectoryRuntime,
  type WorkerLike,
} from "../../../stage/src/transport/trajectory_worker/runtime";

// Re-export everything the original runtime module exposes so call sites
// that import types / classes from the same path keep working.
export type { Format } from "../../../stage/src/transport/trajectory_worker/protocol";
export {
  CancellationError,
  type IndexProgressCallback,
  type OpenOptions,
  type OpenResult,
  TrajectoryRuntime,
  type WorkerLike,
} from "../../../stage/src/transport/trajectory_worker/runtime";

export function spawnTrajectoryWorker(format: Format): TrajectoryRuntime {
  if (typeof Worker === "undefined") {
    throw new Error("TrajectoryRuntime: Worker is not available");
  }
  // Non-literal path: bundlers must not treat this as a worker entry to fold
  // into the main graph. Resolves relative to this module's chunk URL
  // (`…/chunks/shared.js` → `…/chunks/worker.js`).
  const workerScript = "./worker.js";
  const worker = new Worker(new URL(workerScript, import.meta.url), {
    type: "module",
    name: `trajectory-${format}`,
  });
  return new TrajectoryRuntime(worker as WorkerLike, format);
}
