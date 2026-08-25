/**
 * Main-thread lifecycle for the shared compute worker.
 *
 * Spawning needs no host wiring: {@link spawnComputeWorker} (from
 * `@molcrafts/molvis-stage/worker-spawner`) keeps the static
 * `new Worker(new URL(..., import.meta.url))` form, which every rspack-based
 * host folds into its own build (same pattern as the trajectory worker) —
 * the one exception is the VS Code webview, which builds the worker
 * separately and aliases the whole worker-spawner subpath at build time.
 * The async spawn bridges into core's synchronous `createWorker` factory
 * through {@link DeferredWorker}.
 * Tests inject a fake host via {@link setComputeRuntimeForTests}.
 * Domain adapters (e.g. `optimize/worker_client`) build on this module —
 * never the other way around.
 */

import {
  createWorkloadSingleton,
  WorkloadHost,
} from "@molcrafts/molvis-core/workload";
// Only the spawn function crosses the replaceable seam (hosts alias the
// worker-spawner specifier to swap spawning). DeferredWorker is shared
// bridging code every graph needs verbatim — imported relatively so an
// aliasing host does not have to re-export it.
import { spawnComputeWorker } from "@molcrafts/molvis-stage/worker-spawner";
import { DeferredWorker } from "../worker_spawner";
import type { ComputeJob, ComputeProgress, ComputeResult } from "./protocol";

/** The workload host specialized to this package's compute job envelope. */
export type ComputeWorkloadHost = WorkloadHost<
  ComputeJob,
  ComputeResult,
  ComputeProgress
>;

/** Status-line beat while waiting for worker boot, so the UI looks alive. */
const HEARTBEAT_MS = 2_000;

/**
 * Await the worker's boot handshake, beating a status line while it takes.
 *
 * Every domain adapter (optimize, analysis) needs the same wait: `whenReady()`
 * — resolved once the worker has loaded its modules and its WebAssembly and
 * posted `ready` — with a periodic beat so a slow first boot never looks
 * frozen. `onBeat` renders one status line; the caller decides which of its
 * own progress shapes carries it. The boot deadline is owned by the host
 * (`readyTimeoutMs` in the singleton factory below), so any timeout rejection
 * arrives through `whenReady()` with the host's `[molvis-compute]` prefix and
 * propagates unchanged.
 *
 * The first beat is only due after 2 s, so an already-warm host resolves without
 * ever calling `onBeat`: a second job reports nothing but its own progress.
 * Boot is per host, not per job — this only waits, it never spawns.
 *
 * @param host the compute host to wait on (see {@link getComputeRuntime})
 * @param onBeat renders the current boot status line; called repeatedly until
 *   the worker is ready
 * @throws Error the host's own boot failure — worker error, dispose, or its
 *   30 s `readyTimeoutMs` expiry
 */
export async function awaitComputeHostReady(
  host: ComputeWorkloadHost,
  onBeat: (message: string) => void,
): Promise<void> {
  const hb = setInterval(
    () => onBeat("Starting compute worker…"),
    HEARTBEAT_MS,
  );
  try {
    await host.whenReady();
  } finally {
    clearInterval(hb);
  }
}

const singleton = createWorkloadSingleton<
  ComputeJob,
  ComputeResult,
  ComputeProgress
>(
  () =>
    new WorkloadHost({
      name: "molvis-compute",
      // The double assertion is confined to this seam: WorkloadHost only
      // touches onmessage/onerror/postMessage/terminate, exactly the
      // surface DeferredWorker implements (same precedent as the
      // WorkerLikeAdapter in the trajectory runtime).
      createWorker: () =>
        new DeferredWorker(spawnComputeWorker()) as unknown as Worker,
      // Fail fast on a broken worker URL / chunk. Boot includes the molrs
      // WASM fetch (cached after the main bundle loads it), so allow a slow
      // first hit.
      readyTimeoutMs: 30_000,
    }),
);

/**
 * The process-wide compute host, spawning the worker on first use.
 *
 * Cheap to call per job — the same host is returned until it dies (worker
 * error or `dispose()`), in which case the next call spawns a replacement.
 */
export function getComputeRuntime(): ComputeWorkloadHost {
  return singleton.get();
}

/**
 * Swap in a fake host so unit tests never spawn a real worker or load WASM.
 * Disposes whatever host was installed before; pass `null` to restore lazy
 * spawning of the real one.
 */
export function setComputeRuntimeForTests(
  host: ComputeWorkloadHost | null,
): void {
  singleton.setForTests(host);
}

/**
 * Spawn the compute worker when the user opens Optimize / Compute.
 * The worker's `ready` arrives after its module graph + molrs WASM are
 * live, so a warmed worker starts the first job immediately.
 *
 * Idempotent: later calls await the same already-live worker. The promise
 * rejects if the worker fails to boot (bad worker chunk / URL), so a warm-up
 * that only wants to hide latency should ignore the rejection rather than
 * surface it as a job failure.
 */
export function warmComputeWorker(): Promise<void> {
  return getComputeRuntime().whenReady();
}

/**
 * Terminate the process-wide compute worker, if one was spawned.
 * Idempotent — safe to call from {@link MolvisApp.destroy} and tests.
 */
export function disposeComputeRuntime(): void {
  singleton.setForTests(null);
}
