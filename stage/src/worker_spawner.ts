/**
 * The single spawn module for stage's two workers (trajectory + compute),
 * published as the `@molcrafts/molvis-stage/worker-spawner` subpath export.
 *
 * ## Why one module — the literal-URL bundler constraint
 *
 * rspack only folds a worker chunk when it sees the static
 * `new Worker(new URL(..., import.meta.url))` expression inside the file it
 * is compiling — both literals must therefore live here, verbatim. rslib
 * builds this package bundleless, transpiling `.ts` → `.js` while leaving
 * the URL strings untouched; this file lands at `dist/worker_spawner.js`
 * (package root), so both URLs are written dist-relative:
 * `./transport/trajectory_worker/worker.js` and `./compute/worker.js`.
 *
 * These worker chunks pull shared split chunks, so the folding host MUST
 * emit ESM with `import`-based worker chunk loading: the page sets
 * `output.module: true` (rsbuild), the stage viewer bundle sets
 * `workerChunkLoading: "import"` (rslib is already ESM), and the repo
 * `.browserslistrc` keeps the browser floor module-worker-capable. Under
 * legacy `importScripts` loading a module worker dies at boot.
 *
 * ## The alias seam contract
 *
 * Hosts that must build the workers separately (VS Code webview) replace
 * this whole module by aliasing the exact request
 * `@molcrafts/molvis-stage/worker-spawner` to their own implementation
 * with seam-identical signatures (`vsc-ext/src/webview/worker_spawner.ts`
 * via `resolve.alias`). Stage's own consumers import through the package
 * self-reference — never a relative path — so the seam appears as one
 * stable specifier in every graph. Keep this module single-purpose: it is
 * the unit of replacement.
 *
 * Tests should NOT call the spawn functions — construct `TrajectoryRuntime`
 * with an injected fake worker, or `DeferredWorker` with a hand-settled
 * promise, instead.
 */

import type { Format } from "./transport/trajectory_worker/protocol";
import {
  TrajectoryRuntime,
  type WorkerLike,
} from "./transport/trajectory_worker/runtime";
import { logger } from "./utils/logger";

/** Throws if the user-agent doesn't support module workers. */
function assertWorkerCtor(): void {
  if (typeof Worker === "undefined") {
    throw new Error("worker_spawner: Worker is not available");
  }
}

/**
 * Spawn the trajectory worker and wrap it in a {@link TrajectoryRuntime}.
 *
 * Async by seam contract: host replacements (VS Code webview blob
 * bootstrap) genuinely await network fetches before the worker exists, so
 * the shared signature is `Promise<TrajectoryRuntime>` even though this
 * implementation resolves immediately.
 */
export async function spawnTrajectoryWorker(
  format: Format,
): Promise<TrajectoryRuntime> {
  assertWorkerCtor();
  // The `new Worker(new URL(…))` form must stay literal here — rspack only
  // folds worker chunks when it sees that static expression in this file.
  // VS Code webviews replace this module via the worker-spawner alias.
  const worker = new Worker(
    new URL("./transport/trajectory_worker/worker.js", import.meta.url),
    {
      type: "module",
      name: `trajectory-${format}`,
    },
  );
  logger.info(`[trajectory-runtime] spawned worker for ${format}`);
  return new TrajectoryRuntime(worker as WorkerLike, format);
}

/**
 * Spawn the shared compute worker. Async by the same seam contract as
 * {@link spawnTrajectoryWorker}; synchronous callers bridge through
 * {@link DeferredWorker}.
 */
export async function spawnComputeWorker(): Promise<Worker> {
  assertWorkerCtor();
  // The `new Worker(new URL(…))` form must stay literal here — rspack only
  // folds worker chunks when it sees that static expression in this file.
  // VS Code webviews replace this module via the worker-spawner alias.
  return new Worker(new URL("./compute/worker.js", import.meta.url), {
    type: "module",
    name: "molvis-compute",
  });
}

/**
 * Bridge from an async spawn (`Promise<Worker>`) to the synchronous
 * property-style Worker face that core's
 * `WorkloadHostOptions.createWorker: () => Worker` factory demands (01
 * froze the core surface; async-ness is resolved here on the stage side).
 *
 * Deliberately narrow: only the four members `WorkloadHost` touches —
 * `onmessage` / `onerror` setters, `postMessage`, `terminate` — have real
 * behavior. It is not a general Worker; callers cast at the seam
 * (`as unknown as Worker`), same precedent as `WorkerLikeAdapter` in the
 * trajectory runtime.
 *
 * Semantics: `postMessage` buffers until the inner worker resolves, then
 * flushes in order. `terminate()` before resolution terminates the
 * late-arriving inner on arrival and drops the buffer. A rejected spawn
 * promise synthesizes an error event to `onerror`, riding the host's
 * existing `failAll` path (`readyTimeoutMs` is the backstop when no
 * handler is attached yet).
 */
export class DeferredWorker {
  private inner: Worker | null = null;
  private terminated = false;
  private pending: Array<{ message: unknown; transfer?: Transferable[] }> = [];
  private messageHandler: ((ev: MessageEvent) => void) | null = null;
  private errorHandler: ((ev: ErrorEvent) => void) | null = null;

  constructor(spawn: Promise<Worker>) {
    spawn.then(
      (worker) => this.adopt(worker),
      (reason: unknown) => {
        this.pending = [];
        if (this.terminated) return;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        this.errorHandler?.(
          new ErrorEvent("error", {
            message: `worker spawn failed: ${message}`,
          }),
        );
      },
    );
  }

  /** Wire the resolved inner worker and flush the buffered messages. */
  private adopt(worker: Worker): void {
    if (this.terminated) {
      worker.terminate();
      return;
    }
    this.inner = worker;
    worker.onmessage = (ev) => this.messageHandler?.(ev);
    worker.onerror = (ev) => this.errorHandler?.(ev);
    const queued = this.pending;
    this.pending = [];
    for (const { message, transfer } of queued) {
      worker.postMessage(message, transfer ?? []);
    }
  }

  set onmessage(handler: ((ev: MessageEvent) => void) | null) {
    this.messageHandler = handler;
  }

  set onerror(handler: ((ev: ErrorEvent) => void) | null) {
    this.errorHandler = handler;
  }

  postMessage(message: unknown, transfer?: Transferable[]): void {
    if (this.terminated) return;
    if (this.inner) {
      this.inner.postMessage(message, transfer ?? []);
      return;
    }
    this.pending.push({ message, transfer });
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.pending = [];
    this.inner?.terminate();
  }
}
