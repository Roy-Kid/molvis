/**
 * Typed parameters for the trajectory workload channel.
 *
 * The trajectory worker (which owns the `TrajectorySource` and the
 * WebAssembly (WASM) streaming reader) and the main-thread `TrajectoryRuntime` talk over the
 * core workload channel; this module supplies the job, result, progress,
 * and host-call payload types that parameterize that channel. It is not a
 * wire protocol — envelopes, correlation ids, readiness, and cancellation
 * belong to the channel itself.
 *
 * All numeric byte offsets are JS `number` (safe-int up to 2^53). The
 * streaming pipeline caps trajectory size at 1 TB, well within safe-int —
 * byte offsets stay exact without BigInt on either side of the channel.
 *
 * Every typed-array field in a `FrameMessage` is added to the
 * `postMessage` transfer list — ownership moves to the receiver, the
 * sender must not retain references after sending.
 */

export type Format =
  | "lammps-dump"
  | "xyz"
  | "pdb"
  | "lammps"
  | "sdf"
  | "dcd"
  | "xtc"
  | "trr";

// ---------------------------------------------------------------------------
//  Source handles
// ---------------------------------------------------------------------------

/**
 * Source handle the worker sees. We deliberately do NOT pass the
 * `Blob` directly through `postMessage` — Chrome (especially in dev
 * mode under HMR wrapping) silently drops or stalls main→worker
 * messages whose payload references very large Blobs. Instead the
 * worker is told the source size + kind, then issues `RequestBytes`
 * host-calls back to the main thread for each byte range it needs. The
 * main thread holds the live Blob and answers with transferable
 * `ArrayBuffer`s — zero clone, zero size limit.
 */
export interface BlobSourceHandle {
  kind: "blob";
  totalBytes: number;
}

/**
 * OPFS-backed source. The worker resolves the path under
 * `/molvis/v1/blob/<filename>` and opens a
 * `FileSystemSyncAccessHandle` for it. Reads happen synchronously
 * inside the worker — no host-call round trip — so this path is
 * substantially cheaper than the blob path on hot frame loads.
 */
export interface OpfsSourceHandle {
  kind: "opfs";
  /** Filename inside the `/molvis/v1/blob/` bucket. */
  filename: string;
}

export type SourceHandle = BlobSourceHandle | OpfsSourceHandle;

// ---------------------------------------------------------------------------
//  Frame payload — the transferable encoding of a single Frame
// ---------------------------------------------------------------------------

export type ColumnPayload =
  | { name: string; dtype: "f64"; data: Float64Array }
  | { name: string; dtype: "u32"; data: Uint32Array }
  | { name: string; dtype: "i32"; data: Int32Array }
  | { name: string; dtype: "string"; data: string[] };

export interface BlockPayload {
  name: string;
  columns: ColumnPayload[];
}

export interface BoxPayload {
  /** Column-major 3×3 lattice matrix, length 9. */
  h: Float64Array;
  /** Cartesian origin in Å, length 3. */
  origin: Float64Array;
  pbc: [boolean, boolean, boolean];
}

export interface GridPayload {
  name: string;
  /** [nx, ny, nz]. */
  shape: Uint32Array;
  /** Cartesian origin in Å, length 3. */
  origin: Float64Array;
  /** Column-major lattice matrix, length 9. */
  cell: Float64Array;
  pbc: [boolean, boolean, boolean];
  arrays: { name: string; data: Float64Array }[];
}

export interface FrameMessage {
  kind: "frame";
  frameId: number;
  blocks: BlockPayload[];
  box: BoxPayload | null;
  grids: GridPayload[];
}

// ---------------------------------------------------------------------------
//  Workload channel parameters
// ---------------------------------------------------------------------------

/**
 * Job submitted by `TrajectoryRuntime` to the trajectory worker over the
 * workload channel.
 *
 * - `open` — attach a source, index it, and stream indexing progress.
 *   `chunkSize` is bytes per indexer feed call (default 8 MiB): smaller
 *   values reduce peak WASM memory at the cost of more wasm-bindgen round
 *   trips; larger values improve indexer throughput but raise the floor on
 *   WASM linear memory and on the indexing-progress refresh granularity.
 *   `fingerprint` is the cache key used to consult the `.molidx` sidecar
 *   before scanning and to write a fresh sidecar after a successful index
 *   pass; when omitted (e.g. for ad-hoc Blobs without identity), the
 *   worker always re-indexes from scratch.
 * - `load-frame` — decode one indexed frame; resolves with a
 *   `FrameMessage`.
 * - `close` — release the WASM streams and the source.
 */
export type TrajectoryJob =
  | {
      kind: "open";
      source: SourceHandle;
      format: Format;
      chunkSize?: number;
      fingerprint?: string;
    }
  | { kind: "load-frame"; frameId: number }
  | { kind: "close" };

/**
 * Result the worker returns for a `TrajectoryJob`, matched by kind:
 * `open` → `open-result`, `load-frame` → `FrameMessage`, `close` →
 * `closed`. `indexComplete: false` marks an early-resolved open whose
 * index scan is still running.
 */
export type TrajectoryJobResult =
  | {
      kind: "open-result";
      frameCount: number;
      totalBytes: number;
      indexComplete: boolean;
    }
  | FrameMessage
  | { kind: "closed" };

/**
 * Streaming progress reported while an `open` job indexes the source.
 */
export interface TrajectoryIndexProgress {
  bytesScanned: number;
  totalBytes: number;
  framesIndexedSoFar: number;
}

/**
 * Worker → main host-call payload: ask for a byte range from the source.
 * Correlation is carried by the workload channel's callId — no id field
 * here. The host replies with an `ArrayBuffer` holding exactly the
 * requested bytes, transferred (zero copy).
 */
export interface RequestBytes {
  byteOffset: number;
  byteLen: number;
}

// ---------------------------------------------------------------------------
//  Transfer-list helpers
// ---------------------------------------------------------------------------

/**
 * Collect all transferable buffers in a `FrameMessage`. Pass the result as
 * the second argument to `postMessage` so ownership moves to the receiver.
 *
 * The worker MUST NOT retain references to any of these arrays after
 * `postMessage` — they are detached by structured cloning.
 */
export function frameMessageTransferList(msg: FrameMessage): Transferable[] {
  const out: Transferable[] = [];
  for (const block of msg.blocks) {
    for (const col of block.columns) {
      if (col.dtype !== "string") out.push(col.data.buffer);
    }
  }
  if (msg.box) {
    out.push(msg.box.h.buffer);
    out.push(msg.box.origin.buffer);
  }
  for (const grid of msg.grids) {
    out.push(grid.shape.buffer);
    out.push(grid.origin.buffer);
    out.push(grid.cell.buffer);
    for (const arr of grid.arrays) out.push(arr.data.buffer);
  }
  return out;
}
