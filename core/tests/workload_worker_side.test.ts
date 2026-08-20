import { describe, expect, it } from "@rstest/core";
import {
  installWorkloadHandler,
  isWorkloadResponse,
  type WorkloadRequest,
  type WorkloadResponse,
  type WorkloadWorkerScope,
} from "../src/workload";

interface TestJob {
  n: number;
}

interface TestResult {
  id: number;
}

/** A promise plus its resolver — the only clock these tests use. */
interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Drain the microtask queue. Determinism rule: no wall-clock timers, so job
 * ordering is driven by microtasks and explicit deferreds only.
 */
async function flush(turns = 16): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}

/**
 * A plain {@link WorkloadWorkerScope} in place of the worker global: the
 * handler installs its `onmessage` here and posts into `posted`, so the whole
 * run/cancel/ready loop is driven from the test with no real worker.
 */
class RecordingScope implements WorkloadWorkerScope<TestJob> {
  onmessage: ((ev: MessageEvent<WorkloadRequest<TestJob>>) => void) | null =
    null;
  readonly posted: unknown[] = [];

  postMessage(msg: unknown, _transfer?: Transferable[]): void {
    this.posted.push(msg);
  }

  /** Deliver one host → worker message. */
  send(msg: WorkloadRequest<TestJob>): void {
    this.onmessage?.({ data: msg } as MessageEvent<WorkloadRequest<TestJob>>);
  }

  responses(): WorkloadResponse[] {
    return this.posted.filter(isWorkloadResponse);
  }

  types(): string[] {
    return this.responses().map((msg) => msg.type);
  }

  doneIds(): number[] {
    const ids: number[] = [];
    for (const msg of this.responses()) {
      if (msg.type === "done") ids.push(msg.id);
    }
    return ids;
  }

  progressPayloads(): unknown[] {
    const out: unknown[] = [];
    for (const msg of this.responses()) {
      if (msg.type === "progress") out.push(msg.progress);
    }
    return out;
  }
}

describe("installWorkloadHandler", () => {
  it("installs the loop, posts ready, and runs one job to done", async () => {
    const scope = new RecordingScope();
    installWorkloadHandler<TestJob, TestResult>(
      {
        // No heartbeat: these cases assert message order, not stall padding.
        heartbeatMs: 0,
        async run(job, ctx) {
          ctx.reportProgress({ phase: "work", n: job.n });
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    // `ready` is the boot handshake and lands before any job.
    expect(scope.posted[0]).toEqual({ type: "ready" });
    expect(scope.posted.length).toBe(1);

    scope.send({ type: "run", id: 1, job: { n: 21 } });
    await flush();

    expect(scope.types()).toEqual(["ready", "progress", "done"]);
    expect(scope.progressPayloads()).toEqual([{ phase: "work", n: 21 }]);
    expect(scope.doneIds()).toEqual([1]);
  });

  it("queues a second job until the first completes", async () => {
    const started: number[] = [];
    const gates = new Map<number, Deferred>();
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          started.push(ctx.id);
          const gate = deferred();
          gates.set(ctx.id, gate);
          await gate.promise;
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    scope.send({ type: "run", id: 2, job: { n: 2 } });
    await flush();

    // ac-005: one heavy molrs job in flight at a time. Job 2 must not have
    // touched WASM while job 1 is still running.
    expect(started).toEqual([1]);

    gates.get(1)?.resolve();
    await flush();
    expect(started).toEqual([1, 2]);

    gates.get(2)?.resolve();
    await flush();
    // Results come back in submission order.
    expect(scope.doneIds()).toEqual([1, 2]);
  });

  it("delivers a cancel that arrives before a queued job starts", async () => {
    const cancelledAtStart = new Map<number, boolean>();
    const gate1 = deferred();
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          cancelledAtStart.set(ctx.id, ctx.isCancelled());
          if (ctx.id === 1) await gate1.promise;
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    scope.send({ type: "run", id: 2, job: { n: 2 } });
    scope.send({ type: "cancel", id: 2 });
    gate1.resolve();
    await flush();

    expect(cancelledAtStart.get(1)).toBe(false);
    // A cancel for a job that has not started yet must survive until it does,
    // so the body sees the flag on its first poll instead of doing the work.
    expect(cancelledAtStart.get(2)).toBe(true);
  });
});

interface HostCallMessage {
  type: "host-call";
  callId: number;
  call: unknown;
}

/** Worker → host `host-call` posts. */
function hostCallsOf(scope: RecordingScope): HostCallMessage[] {
  const out: HostCallMessage[] = [];
  for (const msg of scope.posted) {
    if (
      msg !== null &&
      typeof msg === "object" &&
      (msg as { type?: unknown }).type === "host-call"
    ) {
      out.push(msg as HostCallMessage);
    }
  }
  return out;
}

function errorMessagesOf(scope: RecordingScope): string[] {
  const out: string[] = [];
  for (const msg of scope.responses()) {
    if (msg.type === "error") out.push(msg.message);
  }
  return out;
}

describe("installWorkloadHandler fifo default", () => {
  it("settles two jobs in submission order even when the first is slower", async () => {
    const gate = deferred();
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(job, ctx) {
          if (job.n === 1) await gate.promise;
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } }); // slow
    scope.send({ type: "run", id: 2, job: { n: 2 } }); // instant once started
    await flush();
    // scheduling omitted → strictly serial: job 2 waits its turn.
    expect(scope.doneIds()).toEqual([]);

    gate.resolve();
    await flush();
    expect(scope.doneIds()).toEqual([1, 2]);
  });

  it("cancel of a queued id is visible on the run's first check", async () => {
    const gate = deferred();
    const cancelledAtStart = new Map<number, boolean>();
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          cancelledAtStart.set(ctx.id, ctx.isCancelled());
          if (ctx.id === 1) await gate.promise;
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    scope.send({ type: "run", id: 2, job: { n: 2 } });
    scope.send({ type: "cancel", id: 2 });
    gate.resolve();
    await flush();

    expect(cancelledAtStart.get(2)).toBe(true);
  });
});

describe('installWorkloadHandler scheduling: "interleaved"', () => {
  it("completes a short job while a long job is still pending", async () => {
    const gate = deferred();
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        scheduling: "interleaved",
        async run(job, ctx) {
          if (job.n === 1) await gate.promise;
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } }); // long
    scope.send({ type: "run", id: 2, job: { n: 2 } }); // short
    await flush();

    // The short job's done must land while the long job is still awaiting.
    expect(scope.doneIds()).toEqual([2]);

    gate.resolve();
    await flush();
    expect(scope.doneIds()).toEqual([2, 1]);
  });

  it("cancel of a running id mid-await flips ctx.isCancelled()", async () => {
    const gate = deferred();
    const cancelledSeen: boolean[] = [];
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        scheduling: "interleaved",
        async run(job, ctx) {
          if (job.n === 1) {
            cancelledSeen.push(ctx.isCancelled()); // before cancel: false
            await gate.promise;
            cancelledSeen.push(ctx.isCancelled()); // after cancel: true
          }
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    scope.send({ type: "run", id: 2, job: { n: 2 } });
    await flush();
    // Interleaving is in effect: the short job finished mid-long-job.
    expect(scope.doneIds()).toEqual([2]);

    scope.send({ type: "cancel", id: 1 });
    gate.resolve();
    await flush();
    expect(cancelledSeen).toEqual([false, true]);
  });
});

describe("WorkloadWorkerContext.callHost", () => {
  it("posts host-call and resolves with the host-reply result", async () => {
    const results: unknown[] = [];
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          results.push(await ctx.callHost({ byteOffset: 0, byteLen: 4 }));
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    await flush();

    const calls = hostCallsOf(scope);
    expect(calls.length).toBe(1);
    const call = calls[0];
    if (!call) throw new Error("host-call was not posted");
    expect(typeof call.callId).toBe("number");
    expect(call.call).toEqual({ byteOffset: 0, byteLen: 4 });

    scope.send({
      type: "host-reply",
      callId: call.callId,
      ok: true,
      result: 42,
    });
    await flush();

    expect(results).toEqual([42]);
    expect(scope.doneIds()).toEqual([1]);
  });

  it("rejects when the host replies ok: false", async () => {
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          await ctx.callHost({ byteOffset: 8, byteLen: 2 });
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    await flush();
    const calls = hostCallsOf(scope);
    expect(calls.length).toBe(1);
    const call = calls[0];
    if (!call) throw new Error("host-call was not posted");

    scope.send({
      type: "host-reply",
      callId: call.callId,
      ok: false,
      error: "boom",
    });
    await flush();

    const errors = errorMessagesOf(scope);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("boom");
    expect(scope.doneIds()).toEqual([]);
  });

  it("silently ignores a host-reply with an unknown callId", async () => {
    const results: unknown[] = [];
    const scope = new RecordingScope();

    installWorkloadHandler<TestJob, TestResult>(
      {
        heartbeatMs: 0,
        async run(_job, ctx) {
          results.push(await ctx.callHost({ byteOffset: 0, byteLen: 1 }));
          return { result: { id: ctx.id } };
        },
      },
      scope,
    );

    scope.send({ type: "run", id: 1, job: { n: 1 } });
    await flush();
    const calls = hostCallsOf(scope);
    expect(calls.length).toBe(1);
    const call = calls[0];
    if (!call) throw new Error("host-call was not posted");

    // A stray reply for a callId nobody registered: no throw, no settle.
    scope.send({ type: "host-reply", callId: 9999, ok: true, result: -1 });
    await flush();
    expect(scope.doneIds()).toEqual([]);
    expect(errorMessagesOf(scope)).toEqual([]);

    // The pending call is unaffected and still resolves normally.
    scope.send({
      type: "host-reply",
      callId: call.callId,
      ok: true,
      result: 42,
    });
    await flush();
    expect(results).toEqual([42]);
    expect(scope.doneIds()).toEqual([1]);
  });
});
