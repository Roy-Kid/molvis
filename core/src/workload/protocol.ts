/**
 * Generic dedicated-worker workload envelope.
 *
 * Domain jobs (optimize, analysis, …) plug their own `TJob` /
 * `TResult` / `TProgress` — this module only owns id-correlated messaging,
 * cancel, and the ready handshake.
 */

/**
 * Main → worker: start a job, ask a running one to stop, or answer a
 * worker-initiated {@link WorkloadResponse} `host-call`.
 *
 * `host-reply` closes the host-call/host-reply pair: it echoes the worker's
 * `callId` and carries either an opaque `result` (`ok: true`) or an `error`
 * string (`ok: false`). Core only routes the reply back to the pending call —
 * `THostReply` is never interpreted here; its shape belongs to domain code.
 */
export type WorkloadRequest<TJob = unknown, THostReply = unknown> =
  | { type: "run"; id: number; job: TJob }
  | { type: "cancel"; id: number }
  | {
      type: "host-reply";
      callId: number;
      ok: boolean;
      result?: THostReply;
      error?: string;
    };

/**
 * Worker → main. `ready` is the one-off boot handshake and carries no id;
 * `progress` / `done` / `error` are correlated by the id of the `run` that
 * started them. By convention a cancelled job answers `done` with whatever
 * partial result it reached, so `error` stays reserved for genuine failures.
 *
 * `host-call` opens the host-call/host-reply pair: the worker asks the host
 * to do something on its behalf and awaits the matching
 * {@link WorkloadRequest} `host-reply`. `callId` lives in its own worker-side
 * counter space, independent of job ids. The `call` payload is opaque to
 * core — `THostCall` is carried, never interpreted.
 */
export type WorkloadResponse<
  TResult = unknown,
  TProgress = unknown,
  THostCall = unknown,
> =
  | { type: "ready" }
  | { type: "progress"; id: number; progress: TProgress }
  | { type: "done"; id: number; result: TResult }
  | { type: "error"; id: number; message: string }
  | { type: "host-call"; callId: number; call: THostCall };

/**
 * Narrow an unknown `message` event payload to a {@link WorkloadResponse}.
 *
 * A tag check only: it proves the message came from this envelope, not that
 * `id` / `result` / `progress` are present or well-typed. Domain code still
 * validates its own payload.
 *
 * @param msg raw `event.data` from the worker's message port
 * @returns true when `msg.type` is one of the five envelope tags
 */
export function isWorkloadResponse(msg: unknown): msg is WorkloadResponse {
  if (!msg || typeof msg !== "object") return false;
  const t = (msg as { type?: unknown }).type;
  return (
    t === "ready" ||
    t === "progress" ||
    t === "done" ||
    t === "error" ||
    t === "host-call"
  );
}
