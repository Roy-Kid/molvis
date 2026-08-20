/**
 * Public surface of the trajectory worker transport: the main-thread
 * `TrajectoryRuntime` (a workload-channel client), the frame codec
 * (`rehydrateFrame` / `frameMessageTransferList`), and the typed
 * job/result/progress/host-call parameters from `./protocol`.
 *
 * The hand-rolled wire-envelope types (`OpenRequest`, `BytesResponse`,
 * `WorkerHeartbeat`, …) died with the wire protocol — a deliberate
 * breaking change on the `./trajectory-protocol` subpath (spec
 * worker-arch-unify-02-runtime); envelopes now live in `core/workload`.
 */

export { rehydrateFrame } from "./frame_codec";
export type {
  BlockPayload,
  BoxPayload,
  ColumnPayload,
  Format,
  FrameMessage,
  GridPayload,
  RequestBytes,
  SourceHandle,
  TrajectoryIndexProgress,
  TrajectoryJob,
  TrajectoryJobResult,
} from "./protocol";
export { frameMessageTransferList } from "./protocol";
export {
  CancellationError,
  type IndexProgressCallback,
  type OpenOptions,
  type OpenResult,
  spawnTrajectoryWorker,
  TrajectoryRuntime,
  type WorkerLike,
} from "./runtime";
