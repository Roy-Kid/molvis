/**
 * Worker-side helpers for the generic workload protocol whose main-thread
 * half is `WorkloadHost` (`./host.ts`).
 *
 * Call {@link installWorkloadHandler} once at the top of a dedicated
 * worker module. Domain code only implements `run`.
 */

/// <reference lib="webworker" />

import type { WorkloadRequest, WorkloadResponse } from "./protocol";

/** What a job implementation gets besides its payload. */
export interface WorkloadWorkerContext {
  /** Correlated job id from the host. */
  id: number;
  /**
   * True after the host sent `{ type: "cancel", id }` for this job. A flag to
   * poll, not a signal that interrupts — nothing stops until the job checks it.
   */
  isCancelled: () => boolean;
  /**
   * Stream progress (any domain shape) to the host as
   * `{ type: "progress", id, progress }`. Also arms the heartbeat: see
   * {@link WorkloadHandlerOptions.heartbeatMs}.
   */
  reportProgress: (progress: unknown) => void;
  /**
   * Ask the host to do something on the worker's behalf and await its answer.
   *
   * Posts `{ type: "host-call", callId, call }` (with `transfer` forwarded to
   * `postMessage`, so byte payloads move zero-copy) and resolves with the
   * host's `result` when the matching `{ type: "host-reply", callId, ok: true }`
   * arrives. An `ok: false` reply rejects with
   * `[workload] host call <callId>: <error>`. The `call` payload is opaque to
   * this layer — its shape is a domain contract with the host's `onHostCall`.
   *
   * `callId` is auto-incremented per worker realm and independent of job ids;
   * pending calls are shared across concurrently interleaved jobs and die with
   * the worker (host `dispose()` needs no cross-realm cleanup).
   */
  callHost: (call: unknown, transfer?: Transferable[]) => Promise<unknown>;
}

/**
 * The slice of `DedicatedWorkerGlobalScope` that
 * {@link installWorkloadHandler} touches.
 *
 * Exists so a unit test can drive the handler with a plain object instead of a
 * real worker global — production callers pass nothing and get `self`.
 */
export interface WorkloadWorkerScope<TJob> {
  onmessage: ((ev: MessageEvent<WorkloadRequest<TJob>>) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
}

/** Domain hooks for {@link installWorkloadHandler}. */
export interface WorkloadHandlerOptions<TJob, TResult> {
  /**
   * Execute one job. May be async; cooperative cancel via
   * `ctx.isCancelled()` between chunks. A thrown error is reported to the host
   * as `{ type: "error" }` — it never becomes an unhandled rejection.
   *
   * Buffers returned in `transfer` are transferred with the `done` message
   * (and detached inside the worker), so return every result array that the
   * worker no longer needs.
   */
  run: (
    job: TJob,
    ctx: WorkloadWorkerContext,
  ) => Promise<{ result: TResult; transfer?: Transferable[] }>;
  /**
   * Re-post the **last** progress payload this often while a job runs, so a
   * host-side stall watch does not fire during a long silent stretch.
   *
   * The heartbeat repeats real progress and never invents a percentage, so no
   * beat is sent until the job has called `ctx.reportProgress` at least once.
   * And, like any worker timer, a beat can only land when the job yields to the
   * worker event loop: a fully synchronous WebAssembly (WASM) call blocks the heartbeat as
   * well, and the pending beat arrives once that call returns.
   *
   * Default 8 s; set 0 to disable.
   */
  heartbeatMs?: number;
  /**
   * How run requests share the single worker realm. Default `"fifo"`.
   *
   * - `"fifo"` — strictly serial: requests queue in arrival order and a job's
   *   `run` is not invoked until the previous job posted `done` or `error`.
   *   One heavy WASM job per realm, which keeps two big
   *   allocations from meeting in the same heap.
   * - `"interleaved"` — every request starts immediately; jobs cooperatively
   *   interleave at their own `await` boundaries (e.g. a `ctx.callHost`
   *   round-trip). This is event-loop interleaving, **not** parallelism: the
   *   realm still has one thread and one WASM heap, so a fully synchronous
   *   stretch in one job blocks all others until it yields. Use it when a
   *   long streaming job must not starve short requests; spawn another worker
   *   for real parallelism.
   *
   * Cancel semantics are identical in both modes: the flag is remembered
   * until the job it names settles, so a queued fifo job sees it on its first
   * poll and an interleaved job should check `ctx.isCancelled()` at its start.
   */
  scheduling?: "fifo" | "interleaved";
}

declare const self: DedicatedWorkerGlobalScope;

/** Default: frequent enough that a 2-minute stall watch rarely false-fires. */
const DEFAULT_HEARTBEAT_MS = 8_000;

/** The seat both scheduling modes fill: accept one run request. */
interface WorkloadScheduler<TJob> {
  enqueue(id: number, job: TJob): void;
}

/**
 * Strictly serial scheduling: each job chains behind the previous one's
 * settlement. Not exported — selected via `scheduling: "fifo"` (the default).
 */
class FifoScheduler<TJob> implements WorkloadScheduler<TJob> {
  /** Tail of the chain of jobs run so far. */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly execute: (id: number, job: TJob) => Promise<void>,
  ) {}

  enqueue(id: number, job: TJob): void {
    // Keep the chain resolved: a rejected tail would skip every later job's
    // `.then` and leave the host waiting forever. `execute` already reports
    // its own failures as `{ type: "error" }`.
    this.chain = this.chain.then(() => this.execute(id, job)).catch(() => {});
  }
}

/**
 * Concurrent-start scheduling: every job begins at once and interleaves with
 * the others at its own await boundaries. Not exported — selected via
 * `scheduling: "interleaved"`.
 */
class InterleavedScheduler<TJob> implements WorkloadScheduler<TJob> {
  constructor(
    private readonly execute: (id: number, job: TJob) => Promise<void>,
  ) {}

  enqueue(id: number, job: TJob): void {
    // `execute` reports its own failures; the catch is belt-and-braces so a
    // scheduler bug can never surface as an unhandled rejection.
    void this.execute(id, job).catch(() => {});
  }
}

/** One worker-initiated host call awaiting its `host-reply`. */
interface PendingHostCall {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Install the standard run/cancel/ready loop on the worker global, then post
 * `{ type: "ready" }` so the host's `whenReady()` resolves.
 *
 * Call it exactly once per worker module: it assigns `scope.onmessage`, so a
 * second call replaces the first handler.
 *
 * **Scheduling is `"fifo"` by default** — first-in-first-out, one job at a
 * time — and can be switched to `"interleaved"` per worker module; see
 * {@link WorkloadHandlerOptions.scheduling} for the trade-off (single WASM
 * heap, cooperative interleaving, not parallelism).
 *
 * **Cancel is per job, and never too early.** A `cancel` is remembered for its
 * id whether the job is running, still queued, or the id is unknown, so
 * `ctx.isCancelled()` is already true on a queued job's first poll and it can
 * skip the work entirely. The flag is dropped when that job settles — in
 * either scheduling mode.
 *
 * **The worker can call back.** Each job's `ctx.callHost` opens a
 * `host-call`/`host-reply` round-trip answered by the host's `onHostCall`;
 * a `host-reply` whose `callId` matches no pending call is silently ignored.
 *
 * @param options the domain `run` implementation, plus the heartbeat interval
 *   and scheduling mode
 * @param scope where to install, defaulting to the worker global. It exists for
 *   unit tests, which pass a plain {@link WorkloadWorkerScope} so the loop runs
 *   with no real worker; production worker modules omit it.
 */
export function installWorkloadHandler<TJob, TResult>(
  options: WorkloadHandlerOptions<TJob, TResult>,
  scope: WorkloadWorkerScope<TJob> = self,
): void {
  /** Ids the host asked to cancel, kept until the job they name settles. */
  const cancelled = new Set<number>();
  /** Worker-realm host-call ids: shared across jobs, unrelated to job ids. */
  let nextCallId = 0;
  /** Host calls awaiting their reply; dies with the worker realm. */
  const pendingCalls = new Map<number, PendingHostCall>();
  const heartbeatMs =
    options.heartbeatMs === undefined
      ? DEFAULT_HEARTBEAT_MS
      : options.heartbeatMs;

  function post(msg: WorkloadResponse, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      scope.postMessage(msg, transfer);
    } else {
      scope.postMessage(msg);
    }
  }

  function callHost(
    call: unknown,
    transfer?: Transferable[],
  ): Promise<unknown> {
    const callId = nextCallId++;
    return new Promise<unknown>((resolve, reject) => {
      pendingCalls.set(callId, { resolve, reject });
      post({ type: "host-call", callId, call }, transfer);
    });
  }

  async function executeJob(id: number, job: TJob): Promise<void> {
    let lastProgress: unknown = null;
    let settled = false;
    let hb: ReturnType<typeof setInterval> | null = null;
    if (heartbeatMs > 0) {
      hb = setInterval(() => {
        if (settled || lastProgress == null) return;
        // Re-emit last known progress so the UI stall watch resets.
        post({ type: "progress", id, progress: lastProgress });
      }, heartbeatMs);
    }
    try {
      const { result, transfer } = await options.run(job, {
        id,
        isCancelled: () => cancelled.has(id),
        reportProgress: (progress) => {
          lastProgress = progress;
          post({ type: "progress", id, progress });
        },
        callHost,
      });
      post(
        { type: "done", id, result },
        transfer && transfer.length > 0 ? transfer : undefined,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err ?? "Workload failed");
      post({ type: "error", id, message });
    } finally {
      settled = true;
      if (hb != null) clearInterval(hb);
      cancelled.delete(id);
    }
  }

  const scheduler: WorkloadScheduler<TJob> =
    options.scheduling === "interleaved"
      ? new InterleavedScheduler(executeJob)
      : new FifoScheduler(executeJob);

  scope.onmessage = (ev: MessageEvent<WorkloadRequest<TJob>>) => {
    const msg = ev.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "cancel") {
      cancelled.add(msg.id);
      return;
    }

    if (msg.type === "host-reply") {
      const pending = pendingCalls.get(msg.callId);
      // A reply nobody is waiting for (e.g. its job already settled some
      // other way) is dropped, mirroring the host's unknown-id rule.
      if (!pending) return;
      pendingCalls.delete(msg.callId);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        pending.reject(
          new Error(
            `[workload] host call ${msg.callId}: ${msg.error ?? "unknown error"}`,
          ),
        );
      }
      return;
    }

    if (msg.type !== "run") return;

    scheduler.enqueue(msg.id, msg.job);
  };

  post({ type: "ready" });
}
