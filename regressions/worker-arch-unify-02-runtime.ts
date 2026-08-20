/**
 * Runtime lock for spec worker-arch-unify-02-runtime (ac-010):
 * `TrajectoryRuntime` rebuilt on the core workload channel, exercised purely
 * through the `@molcrafts/molvis-stage/trajectory-runtime` public subpath
 * with a fake `WorkerLike` speaking the workload envelope.
 *
 * Goldens are the spec's own literals (defined 2026-08-20 — no third-party
 * oracle): early OpenResult `{ frameCount: 2, indexedLength: 2, length: null,
 * indexComplete: false, totalBytes: 1024 }`, latest-wins rejection name
 * "CancellationError", host-call reply bytes [1, 2, 3, 4].
 *
 * Run with the repo TS runner: `node regressions/worker-arch-unify-02-runtime.ts`
 * after `npm run build:stage`.
 *
 * The `.wasm` loader stub exists only because the runtime module's
 * frame_codec imports the bundler-target molrs glue, which node's ESM loader
 * cannot evaluate. Nothing below decodes a frame, so no WebAssembly (WASM) module is
 * instantiated and no real worker is spawned.
 */
import { registerHooks } from "node:module";
import type { WorkerLike } from "@molcrafts/molvis-stage/trajectory-runtime";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

registerHooks({
  load(url, context, next) {
    if (!url.endsWith(".wasm")) return next(url, context);
    return {
      format: "module",
      shortCircuit: true,
      source: "export function __wbindgen_start() {}\n",
    };
  },
});

const { TrajectoryRuntime } = await import(
  "@molcrafts/molvis-stage/trajectory-runtime"
);

/** Host → worker half of the workload envelope the fake worker consumes. */
type HostToWorker =
  | { type: "run"; id: number; job: { kind: string } }
  | { type: "cancel"; id: number }
  | {
      type: "host-reply";
      callId: number;
      ok: boolean;
      result?: unknown;
      error?: string;
    };

/** Worker → host half the fake worker emits. */
type WorkerToHost =
  | { type: "ready" }
  | {
      type: "progress";
      id: number;
      progress: {
        bytesScanned: number;
        totalBytes: number;
        framesIndexedSoFar: number;
      };
    }
  | {
      type: "host-call";
      callId: number;
      call: { byteOffset: number; byteLen: number };
    };

const listeners = new Map<string, Set<(e: Event) => void>>();

function emitToHost(msg: WorkerToHost): void {
  queueMicrotask(() => {
    const set = listeners.get("message");
    if (!set) return;
    for (const listener of [...set]) {
      listener({ data: msg } as unknown as Event);
    }
  });
}

let readySent = false;
let resolveHostReply:
  | ((reply: { ok: boolean; result?: unknown }) => void)
  | null = null;

const fakeWorker: WorkerLike = {
  postMessage(message: unknown): void {
    const msg = message as HostToWorker;
    if (msg.type === "run" && msg.job.kind === "open") {
      // Two frames indexed on the first progress tick: the runtime's
      // earlyResolve turns this into the early OpenResult golden.
      emitToHost({
        type: "progress",
        id: msg.id,
        progress: {
          bytesScanned: 1024,
          totalBytes: 1024,
          framesIndexedSoFar: 2,
        },
      });
      return;
    }
    if (msg.type === "host-reply") {
      resolveHostReply?.({ ok: msg.ok, result: msg.result });
      resolveHostReply = null;
    }
    // "cancel" and load-frame "run"s stay unanswered on purpose: reject-mode
    // cancellation settles host-side, and the superseded load never completes.
  },
  addEventListener(type, listener): void {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    set.add(listener);
    if (type === "message" && !readySent) {
      readySent = true;
      emitToHost({ type: "ready" });
    }
  },
  removeEventListener(type, listener): void {
    listeners.get(type)?.delete(listener);
  },
  terminate(): void {},
};

const runtime = new TrajectoryRuntime(fakeWorker, "xyz");

// The fake source serves reads out of a pooled backing buffer, so the byte
// golden below only passes when the runtime copies into a packed buffer
// before transfer (the VS Code IPC pooled-buffer rule) instead of shipping
// the whole pool.
const pool = new Uint8Array([9, 9, 1, 2, 3, 4, 9, 9]);
const source = {
  kind: "blob" as const,
  size: async () => 1024,
  readRange: async (start: number, end: number) =>
    pool.subarray(2 + start, 2 + end),
};

// Golden 1: open() early-resolves on the first indexed-frames progress.
const openResult = await runtime.open(source);
assert(
  openResult.frameCount === 2 &&
    openResult.indexedLength === 2 &&
    openResult.length === null &&
    openResult.indexComplete === false &&
    openResult.totalBytes === 1024,
  `early OpenResult ${JSON.stringify(openResult)}`,
);

// Golden 2: latest-wins — the superseded loadFrameLatest rejects with the
// stage CancellationError, never the channel's WorkloadCancelledError.
const superseded = runtime.loadFrameLatest(0);
void runtime.loadFrameLatest(1).catch(() => {
  // Intentionally never settled by the fake worker.
});

let cancelError: unknown = null;
try {
  await superseded;
} catch (err) {
  cancelError = err;
}
assert(
  cancelError instanceof Error && cancelError.name === "CancellationError",
  `latest-wins rejection name ${
    cancelError instanceof Error ? cancelError.name : String(cancelError)
  }`,
);

// Golden 3: a worker host-call for bytes is answered from the live source
// as a packed ArrayBuffer.
const reply = await new Promise<{ ok: boolean; result?: unknown }>(
  (resolve) => {
    resolveHostReply = resolve;
    emitToHost({
      type: "host-call",
      callId: 1,
      call: { byteOffset: 0, byteLen: 4 },
    });
  },
);
assert(reply.ok, "host-call reply not ok");
assert(
  reply.result instanceof ArrayBuffer,
  "host-call reply is not an ArrayBuffer",
);
const bytes = Array.from(new Uint8Array(reply.result));
assert(
  bytes.join(",") === "1,2,3,4",
  `host-call reply bytes [${bytes.join(", ")}]`,
);

console.log("worker-arch-unify-02-runtime ok");
