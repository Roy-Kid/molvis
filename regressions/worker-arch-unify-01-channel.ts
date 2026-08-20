/**
 * Channel lock for the core workload extensions of spec
 * worker-arch-unify-01-channel: "interleaved" worker-side scheduling, the
 * worker→host `callHost` round-trip, and `cancelMode: "reject"`.
 *
 * Goldens are the spec's own literals (ac-009, defined 2026-08-20 — no
 * third-party oracle): interleaved settlement order ["short-done",
 * "long-done"], host-call echo result 42, reject-cancel error name
 * "WorkloadCancelledError".
 *
 * Run with the repo TS runner: `node regressions/worker-arch-unify-01-channel.ts`
 * after `npm run build:core`.
 *
 * Everything below goes through the `@molcrafts/molvis-core/workload` public
 * subpath (core/dist). The worker realm is a plain in-memory
 * `WorkloadWorkerScope`; a fake Worker object bridges postMessage/onmessage
 * both ways with microtask delivery, so no real worker is spawned, no WASM
 * (WebAssembly) module is instantiated, and no loader shim is needed — the
 * workload module imports nothing from molrs.
 */
import type {
  WorkloadRequest,
  WorkloadWorkerScope,
} from "@molcrafts/molvis-core/workload";
import {
  installWorkloadHandler,
  WorkloadHost,
} from "@molcrafts/molvis-core/workload";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

type ChannelJob = { kind: "long" | "short" | "cancel-target" };
type ChannelResult = { label: string; echoed: number | null };

/** Worker-side half: a plain object standing in for the worker global. */
let deliverToHost: (msg: unknown) => void = () => {};
const scope: WorkloadWorkerScope<ChannelJob> = {
  onmessage: null,
  postMessage(msg) {
    queueMicrotask(() => deliverToHost(msg));
  },
};

/** Host-side half: the fake Worker handed to WorkloadHost via createWorker. */
const fakeWorker = {
  onmessage: null as ((ev: MessageEvent<unknown>) => void) | null,
  onerror: null as ((ev: { message?: string }) => void) | null,
  postMessage(msg: unknown) {
    queueMicrotask(() => {
      scope.onmessage?.({
        data: msg,
      } as MessageEvent<WorkloadRequest<ChannelJob>>);
    });
  },
  terminate() {},
};
deliverToHost = (msg) => {
  fakeWorker.onmessage?.({ data: msg } as MessageEvent<unknown>);
};

installWorkloadHandler<ChannelJob, ChannelResult>(
  {
    scheduling: "interleaved",
    heartbeatMs: 0,
    run: async (job, ctx) => {
      if (job.kind === "long") {
        // The await is the interleave point: the short job settles while
        // this round-trip is in flight.
        const echoed = await ctx.callHost({ echo: 42 });
        return { result: { label: "long-done", echoed: echoed as number } };
      }
      if (job.kind === "short") {
        return { result: { label: "short-done", echoed: null } };
      }
      // cancel-target: yield once so the host-side reject lands first; the
      // late done below is dropped by the host's unknown-id rule.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { result: { label: "never-observed", echoed: null } };
    },
  },
  scope,
);

const host = new WorkloadHost<
  ChannelJob,
  ChannelResult,
  unknown,
  { echo: number },
  number
>({
  name: "channel-regression",
  createWorker: () => fakeWorker as unknown as Worker,
  onHostCall: async (call) => ({ result: call.echo }),
});

// Golden 1 + 2: interleaved settlement order and the host-call echo path.
const settlementOrder: string[] = [];
const long = host.submit({ kind: "long" });
const short = host.submit({ kind: "short" });
void long.result.then((r) => settlementOrder.push(r.label));
void short.result.then((r) => settlementOrder.push(r.label));

const [longResult] = await Promise.all([long.result, short.result]);

assert(
  settlementOrder.join(",") === "short-done,long-done",
  `interleaved settlement order ${settlementOrder.join(",")}`,
);
assert(longResult.echoed === 42, `host-call echo ${longResult.echoed}`);

// Golden 3: cancelMode "reject" rejects with WorkloadCancelledError.
const cancelTicket = host.submit(
  { kind: "cancel-target" },
  { cancelMode: "reject" },
);
host.cancel(cancelTicket.id);

let cancelError: unknown = null;
try {
  await cancelTicket.result;
} catch (err) {
  cancelError = err;
}

assert(
  cancelError instanceof Error && cancelError.name === "WorkloadCancelledError",
  `reject-cancel error name ${
    cancelError instanceof Error ? cancelError.name : String(cancelError)
  }`,
);

console.log("worker-arch-unify-01-channel ok");
