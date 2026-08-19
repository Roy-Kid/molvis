/// <reference lib="webworker" />

/**
 * Dedicated worker entrypoint for streaming trajectory parsing.
 *
 * Owns:
 *   - One `TrajectorySource`: either a `MainThreadBlobSource` (the
 *     blob lives on the main thread; we pull bytes via `request-bytes`)
 *     or an `OPFSSyncRangeSource` (OPFS-cached file, synchronous reads
 *     against a `FileSystemSyncAccessHandle`).
 *   - One per-format WASM streaming reader (`WasmLammpsDumpStream`, etc.).
 *   - The frame index, either built from a chunked feed pass or restored
 *     from a `.molidx` sidecar in OPFS when the caller passes a
 *     fingerprint and a matching cache entry exists.
 *
 * Responds to messages from `TrajectoryRuntime` on the main thread —
 * see `protocol.ts` for the full message schema.
 *
 * Keep this file dependency-light: it gets bundled separately by
 * rspack's worker loader and shouldn't drag in any of MolVis's
 * scene/rendering code.
 */

import { wasmMemory } from "@molcrafts/molvis-core/molrs";
import { OpfsBlobCache } from "@molcrafts/molvis-core/opfs";
import { decideMolidxUse } from "../../io/cache/molidx_codec";
import { OpfsIndexCache } from "../../io/cache/opfs_index_cache";
import { OPFSSyncRangeSource } from "../../io/sources/opfs_sync_range_source";
import type { TrajectorySource } from "../../io/sources/trajectory_source";
import type {
  BlockPayload,
  BoxPayload,
  CancelRequest,
  CloseRequest,
  ColumnPayload,
  Format,
  FrameError,
  FrameMessage,
  GridPayload,
  IndexProgress,
  IndexReady,
  LoadFrameRequest,
  OpenError,
  OpenRequest,
  WorkerRequest,
} from "./protocol";
import { frameMessageTransferList } from "./protocol";
import { type MolrsTrajStream, makeStream } from "./streams";

// ---------------------------------------------------------------------------
//  Type aliases — every wasm stream class shares the same JS-facing shape,
//  so we abstract over them with a structural type.
// ---------------------------------------------------------------------------

type WasmTrajStream = MolrsTrajStream;

// ---------------------------------------------------------------------------
//  Worker state
// ---------------------------------------------------------------------------

interface WorkerState {
  /** Feeds `feedIndexChunk` / `finishIndex`. */
  indexStream: WasmTrajStream | null;
  /** Decodes one frame via `parseRangeInInput` while indexing continues. */
  parseStream: WasmTrajStream | null;
  /** Active trajectory source, abstracting over blob (reverse-RPC to
   *  main thread) and OPFS (sync handle) backends. */
  source: TrajectorySource | null;
  index: FramePos[];
  cancelledOpenId: number | null;
  cancelledFrameIds: Set<number>;
  /** Pending byte-range requests by fetchId, resolved when the main
   *  thread responds with a `BytesResponse`. */
  pendingFetches: Map<
    number,
    { resolve: (data: ArrayBuffer) => void; reject: (err: Error) => void }
  >;
  nextFetchId: number;
}

/** Plain-object frame position. We never store live `FrameIndexEntry`
 *  instances from wasm-bindgen here — those expose `byteOffset` /
 *  `byteLen` as getter properties that round-trip through wasm on every
 *  read. `appendIndex` materializes them as numbers once. */
interface FramePos {
  byteOffset: number;
  byteLen: number;
}

/** `TrajectorySource` adapter for the main-thread Blob path. The blob
 *  itself never crosses the worker boundary — we ask for byte ranges
 *  via `request-bytes` and the runtime answers with a transferable
 *  `ArrayBuffer`. */
class MainThreadBlobSource implements TrajectorySource {
  readonly kind = "blob" as const;
  constructor(private readonly totalBytes: number) {}
  size(): Promise<number> {
    return Promise.resolve(this.totalBytes);
  }
  readRange(start: number, end: number): Promise<Uint8Array> {
    return fetchBytes(start, end - start);
  }
}

const state: WorkerState = {
  indexStream: null,
  parseStream: null,
  source: null,
  index: [],
  cancelledOpenId: null,
  cancelledFrameIds: new Set(),
  pendingFetches: new Map(),
  nextFetchId: 1,
};

/** Ask the main thread for a byte range and wait for the answer. */
function fetchBytes(byteOffset: number, byteLen: number): Promise<Uint8Array> {
  const fetchId = state.nextFetchId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    state.pendingFetches.set(fetchId, {
      resolve: (data) => resolve(new Uint8Array(data)),
      reject,
    });
    (self as unknown as Worker).postMessage({
      kind: "request-bytes",
      fetchId,
      byteOffset,
      byteLen,
    });
  });
}

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB
const PROGRESS_THROTTLE_MS = 50;

// ---------------------------------------------------------------------------
//  Message dispatch
// ---------------------------------------------------------------------------

const messageHandler = (e: MessageEvent) => {
  const msg = e.data as WorkerRequest;
  switch (msg.kind) {
    case "open":
      handleOpen(msg).catch((err) => sendOpenError(msg.requestId, err));
      return;
    case "load-frame":
      handleLoadFrame(msg).catch((err) =>
        sendFrameError(msg.requestId, msg.frameId, err),
      );
      return;
    case "cancel":
      handleCancel(msg);
      return;
    case "close":
      handleClose(msg);
      return;
    case "bytes": {
      const pending = state.pendingFetches.get(msg.fetchId);
      if (!pending) return;
      state.pendingFetches.delete(msg.fetchId);
      if (msg.error || msg.data === null) {
        pending.reject(new Error(msg.error ?? "byte-range fetch failed"));
      } else {
        pending.resolve(msg.data);
      }
      return;
    }
  }
};

self.addEventListener("message", messageHandler);

// Worker readiness signal. The runtime's `open()` blocks on this
// before posting any business message — without it, Chrome dev-mode
// module workers silently drop pre-init messages. See
// `MEMORY.md` → "Streaming trajectory worker pitfalls".
(self as unknown as Worker).postMessage({ kind: "worker-heartbeat" });

// ---------------------------------------------------------------------------
//  Open / index pass
// ---------------------------------------------------------------------------

async function handleOpen(req: OpenRequest): Promise<void> {
  rejectPendingFetches("worker: new open superseded");

  state.indexStream = makeStream(req.format);
  state.parseStream = makeStream(req.format);
  state.index = [];
  state.cancelledOpenId = null;

  state.source = await resolveSource(req.source);
  const totalBytes = await state.source.size();
  state.indexStream.hintTotalBytes?.(totalBytes);
  const fp = req.fingerprint;

  if (fp) {
    const use = decideMolidxUse(
      await OpfsIndexCache.get(fp),
      totalBytes,
      req.format,
    );
    if (use.action === "hit") {
      state.index = use.index.entries;
      sendIndexReady(req.requestId, totalBytes);
      return;
    }
    if (use.action === "resume") {
      state.index = use.index.entries;
      await runIndexingPass(req, totalBytes, use.scannedBytes);
      if (state.cancelledOpenId === req.requestId) return;
      persistIndex(fp, req.format, totalBytes, true);
      sendIndexReady(req.requestId, totalBytes);
      return;
    }
  }

  await runIndexingPass(req, totalBytes, 0);
  if (state.cancelledOpenId === req.requestId) return;

  persistIndex(fp, req.format, totalBytes, true);
  sendIndexReady(req.requestId, totalBytes);
}

async function resolveSource(
  source: OpenRequest["source"],
): Promise<TrajectorySource> {
  if (source.kind === "blob") {
    return new MainThreadBlobSource(source.totalBytes);
  }
  const handle = await OpfsBlobCache.openSync(source.filename);
  if (!handle) {
    throw new Error(`worker: opfs source '${source.filename}' not found`);
  }
  return OPFSSyncRangeSource.fromHandle(handle);
}

/** Chunked feed loop. Drops partial state and posts an open-error on
 *  cancellation; the caller checks `state.cancelledOpenId` on return
 *  to decide whether to proceed with the cache write-through. */
async function runIndexingPass(
  req: OpenRequest,
  totalBytes: number,
  startAt: number,
): Promise<void> {
  if (!state.indexStream || !state.source) return;
  const chunkSize = Math.max(1, req.chunkSize ?? DEFAULT_CHUNK_SIZE);
  let bytesScanned = startAt;
  let lastProgressAt = 0;
  let announcedFirst = state.index.length >= 1;

  if (startAt > 0 && req.format === "dcd" && state.index[0]) {
    const headerEnd = state.index[0].byteOffset;
    if (headerEnd > 0) {
      const header = await state.source.readRange(0, headerEnd);
      const ptr = state.indexStream.allocInputBuffer(header.byteLength);
      writeIntoWasm(ptr, header);
      state.indexStream.feedIndexChunk(0, header.byteLength);
      copyDecoderContext();
    }
  }

  while (bytesScanned < totalBytes) {
    if (state.cancelledOpenId === req.requestId) {
      state.indexStream = null;
      state.parseStream = null;
      state.index = [];
      state.source?.close?.();
      state.source = null;
      sendOpenError(req.requestId, new Error("cancelled"));
      return;
    }

    const end = Math.min(bytesScanned + chunkSize, totalBytes);
    const len = end - bytesScanned;
    const slice = await state.source.readRange(bytesScanned, end);

    const ptr = state.indexStream.allocInputBuffer(len);
    writeIntoWasm(ptr, slice);

    appendIndex(state.indexStream.feedIndexChunk(bytesScanned, len));
    copyDecoderContext();
    bytesScanned = end;

    if (!announcedFirst && state.index.length >= 1) {
      sendIndexProgress(req.requestId, bytesScanned, totalBytes);
      lastProgressAt = nowMs();
      announcedFirst = true;
      continue;
    }

    const now = nowMs();
    if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
      sendIndexProgress(req.requestId, bytesScanned, totalBytes);
      lastProgressAt = now;
      persistIndex(req.fingerprint, req.format, totalBytes, false);
    }
  }

  appendIndex(state.indexStream.finishIndex());
  copyDecoderContext();
}

/** DCD parse needs the header the indexer already saw. Text / XTC / TRR
 *  streams return an empty context and this is a no-op. */
function persistIndex(
  fingerprint: string | undefined | null,
  format: Format,
  fileSize: number,
  complete: boolean,
): void {
  if (!fingerprint) return;
  const last = state.index[state.index.length - 1];
  void OpfsIndexCache.set(fingerprint, {
    format,
    fileSize,
    totalBytes: fileSize,
    complete,
    scannedBytes: last ? last.byteOffset + last.byteLen : 0,
    entries: state.index,
  });
}

function copyDecoderContext(): void {
  const ctx = state.indexStream?.decoderContext?.();
  if (ctx && ctx.length > 0 && state.parseStream?.setDecoderContext) {
    state.parseStream.setDecoderContext(ctx);
  }
}

// ---------------------------------------------------------------------------
//  Load frame
// ---------------------------------------------------------------------------

async function handleLoadFrame(req: LoadFrameRequest): Promise<void> {
  if (!state.parseStream || !state.source) {
    throw new Error("worker: load-frame before open");
  }
  if (state.cancelledFrameIds.delete(req.requestId)) return; // pre-cancelled

  const pos = state.index[req.frameId];
  if (!pos) {
    throw new Error(`worker: frame ${req.frameId} out of range`);
  }

  const slice = await state.source.readRange(
    pos.byteOffset,
    pos.byteOffset + pos.byteLen,
  );
  if (state.cancelledFrameIds.delete(req.requestId)) return;

  const ptr = state.parseStream.allocInputBuffer(slice.byteLength);
  writeIntoWasm(ptr, slice);

  state.parseStream.parseRangeInInput(0, slice.byteLength);

  // Materialize the parsed frame into the wire payload while WASM
  // memory is still pinned to this parse. After releaseFrame the
  // pointers go stale; before it, every wasm call that resizes memory
  // also detaches the ArrayBuffer view, so we re-derive views as we
  // go, never cache them across calls.
  const blocks = readBlocks(state.parseStream);
  const box = readBox(state.parseStream);
  const grids = readGrids(state.parseStream);

  state.parseStream.releaseFrame();

  const msg: FrameMessage = {
    kind: "frame",
    requestId: req.requestId,
    frameId: req.frameId,
    blocks,
    box,
    grids,
  };
  postWithTransfer(msg, frameMessageTransferList(msg));
}

// ---------------------------------------------------------------------------
//  Output extraction — the hot path. Every wasm call may grow memory, so
//  we re-derive views per call and copy out before the next.
// ---------------------------------------------------------------------------

function readBlocks(s: WasmTrajStream): BlockPayload[] {
  const blockCount = s.blockCount();
  const out: BlockPayload[] = [];
  for (let bi = 0; bi < blockCount; bi++) {
    const blockName = s.blockName(bi);
    const colCount = s.columnCount(bi);
    const columns: ColumnPayload[] = [];
    for (let ci = 0; ci < colCount; ci++) {
      const colName = s.columnName(bi, ci);
      const dtype = s.columnDtype(bi, ci);
      const len = s.columnLen(bi, ci);
      switch (dtype) {
        case "f64": {
          const ptr = s.columnPtrF64(bi, ci);
          const view = new Float64Array(wasmMemory().buffer, ptr, len);
          columns.push({
            name: colName,
            dtype: "f64",
            data: new Float64Array(view), // copy out of WASM
          });
          break;
        }
        case "u32": {
          const ptr = s.columnPtrU32(bi, ci);
          const view = new Uint32Array(wasmMemory().buffer, ptr, len);
          columns.push({
            name: colName,
            dtype: "u32",
            data: new Uint32Array(view),
          });
          break;
        }
        case "i32": {
          const ptr = s.columnPtrI32(bi, ci);
          const view = new Int32Array(wasmMemory().buffer, ptr, len);
          columns.push({
            name: colName,
            dtype: "i32",
            data: new Int32Array(view),
          });
          break;
        }
        case "string": {
          const data = s.columnStrings(bi, ci) as string[];
          columns.push({ name: colName, dtype: "string", data });
          break;
        }
        // bool / u8 / unknown — silently dropped per spec
      }
    }
    out.push({ name: blockName, columns });
  }
  return out;
}

function readBox(s: WasmTrajStream): BoxPayload | null {
  const h = s.boxH();
  const origin = s.boxOrigin();
  if (!h || !origin) return null;
  const pbcRaw = s.boxPbc(); // Vec<u8>(3) per molrs-wasm impl
  const pbc = pbcToTuple(pbcRaw);
  return {
    h: new Float64Array(h),
    origin: new Float64Array(origin),
    pbc,
  };
}

function readGrids(_s: WasmTrajStream): GridPayload[] {
  // molrs >= 0.0.16 dropped the dedicated grid-streaming accessors
  // (gridCount/gridShape/gridArrayPtrF64/...) in favour of the unified
  // "grids are blocks" model. The incremental streaming API
  // (WasmLammpsDumpStream et al.) exposes blocks + columns + box but no
  // per-block shape, so a streamed volumetric "grid" block cannot be
  // reconstructed with geometry here. Streamed trajectories therefore carry
  // no volumetric grids; full-file loads still surface grids via the
  // frame.getBlock("grid") + block.shape() path. The wire shape is kept so
  // the protocol is stable if molrs restores streaming grid metadata.
  return [];
}

function pbcToTuple(raw: unknown): [boolean, boolean, boolean] {
  // molrs-wasm emits pbc as Vec<u8>(3) where 1=true, 0=false.
  const arr = raw as ArrayLike<number> | null | undefined;
  if (!arr || arr.length < 3) return [false, false, false];
  return [Boolean(arr[0]), Boolean(arr[1]), Boolean(arr[2])];
}

// ---------------------------------------------------------------------------
//  Cancel / close
// ---------------------------------------------------------------------------

function handleCancel(req: CancelRequest): void {
  // Open-pass cancel: indexing loop checks this each chunk.
  state.cancelledOpenId = req.targetRequestId;
  // load-frame cancel: marker the frame loop checks at the await boundary.
  state.cancelledFrameIds.add(req.targetRequestId);
}

function handleClose(req: CloseRequest): void {
  state.indexStream?.free?.();
  state.parseStream?.free?.();
  state.indexStream = null;
  state.parseStream = null;
  state.source?.close?.();
  state.source = null;
  state.index = [];
  state.cancelledFrameIds.clear();
  rejectPendingFetches("worker closed");
  postSelf({ kind: "closed", requestId: req.requestId });
}

/** Reject every in-flight `request-bytes` promise. Called from
 *  `handleClose` and at the top of every `handleOpen` so a torn-down
 *  open doesn't leave promises dangling on the next pass. */
function rejectPendingFetches(reason: string): void {
  for (const pending of state.pendingFetches.values()) {
    pending.reject(new Error(reason));
  }
  state.pendingFetches.clear();
}

// ---------------------------------------------------------------------------
//  Message helpers
// ---------------------------------------------------------------------------

function sendIndexProgress(
  requestId: number,
  bytesScanned: number,
  totalBytes: number,
): void {
  const msg: IndexProgress = {
    kind: "index-progress",
    requestId,
    bytesScanned,
    totalBytes,
    framesIndexedSoFar: state.index.length,
  };
  postSelf(msg);
}

function sendIndexReady(requestId: number, totalBytes: number): void {
  const msg: IndexReady = {
    kind: "index-ready",
    requestId,
    frameCount: state.index.length,
    totalBytes,
  };
  postSelf(msg);
}

function sendOpenError(requestId: number, err: Error | unknown): void {
  const msg: OpenError = {
    kind: "open-error",
    requestId,
    message: errorMessage(err),
  };
  postSelf(msg);
}

function sendFrameError(
  requestId: number,
  frameId: number,
  err: Error | unknown,
): void {
  const msg: FrameError = {
    kind: "frame-error",
    requestId,
    frameId,
    message: errorMessage(err),
  };
  postSelf(msg);
}

// ---------------------------------------------------------------------------
//  Low-level helpers
// ---------------------------------------------------------------------------

function appendIndex(
  entries: Array<{ byteOffset: number; byteLen: number }> | null | undefined,
): void {
  if (!entries) return;
  for (const e of entries) {
    // wasm-bindgen returns FrameIndexEntry instances with getter
    // properties — read them as plain numbers and cache for postMessage.
    state.index.push({
      byteOffset: e.byteOffset,
      byteLen: e.byteLen,
    });
  }
}

function writeIntoWasm(ptr: number, src: Uint8Array): void {
  // Re-derive the view immediately before the write — `wasmMemory()`
  // may have grown during the alloc above and detached any prior view.
  const view = new Uint8Array(wasmMemory().buffer, ptr, src.byteLength);
  view.set(src);
}

function postSelf(msg: unknown): void {
  (self as unknown as Worker).postMessage(msg);
}

function postWithTransfer(msg: unknown, transfer: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
