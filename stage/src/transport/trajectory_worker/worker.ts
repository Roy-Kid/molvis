/// <reference lib="webworker" />

/**
 * Dedicated worker entrypoint for streaming trajectory parsing, installed
 * on the core workload channel via {@link installWorkloadHandler}.
 *
 * Owns:
 *   - One `TrajectorySource`: either a `MainThreadBlobSource` (the
 *     blob lives on the main thread; we pull bytes via `RequestBytes`
 *     host-calls) or an `OPFSSyncRangeSource` (OPFS-cached file,
 *     synchronous reads against a `FileSystemSyncAccessHandle`).
 *   - One per-format WebAssembly (WASM) streaming reader
 *     (`WasmLammpsDumpStream`, etc.).
 *   - The frame index, either built from a chunked feed pass or restored
 *     from a `.molidx` sidecar in OPFS when the caller passes a
 *     fingerprint and a matching cache entry exists.
 *
 * Scheduling is `"interleaved"`: a long open/index job yields at every
 * chunk read, so `load-frame` jobs are served while indexing streams —
 * scrubbing stays responsive during the scan. Cancellation is cooperative:
 * jobs poll `ctx.isCancelled()` (per chunk for the index loop, at await
 * boundaries for frame loads). Envelope, correlation, ready handshake, and
 * progress heartbeat all belong to the channel (`core/workload`).
 *
 * Keep this file dependency-light: it gets bundled separately by
 * rspack's worker loader and shouldn't drag in any of MolVis's
 * scene/rendering code.
 */

import { wasmMemory } from "@molcrafts/molvis-core/molrs";
import { OpfsBlobCache } from "@molcrafts/molvis-core/opfs";
import {
  installWorkloadHandler,
  type WorkloadWorkerContext,
} from "@molcrafts/molvis-core/workload";
import { decideMolidxUse } from "../../io/cache/molidx_codec";
import { OpfsIndexCache } from "../../io/cache/opfs_index_cache";
import { OPFSSyncRangeSource } from "../../io/sources/opfs_sync_range_source";
import type { TrajectorySource } from "../../io/sources/trajectory_source";
import type {
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
import { frameMessageTransferList } from "./protocol";
import { type MolrsTrajStream, makeStream } from "./streams";

type OpenJob = Extract<TrajectoryJob, { kind: "open" }>;
type LoadFrameJob = Extract<TrajectoryJob, { kind: "load-frame" }>;

// ---------------------------------------------------------------------------
//  Worker state
// ---------------------------------------------------------------------------

interface WorkerState {
  /** Feeds `feedIndexChunk` / `finishIndex`. */
  indexStream: MolrsTrajStream | null;
  /** Decodes one frame via `parseRangeInInput` while indexing continues. */
  parseStream: MolrsTrajStream | null;
  /** Active trajectory source, abstracting over blob (host-call to
   *  main thread) and OPFS (sync handle) backends. */
  source: TrajectorySource | null;
  index: FramePos[];
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
 *  via `RequestBytes` host-calls and the runtime answers with a
 *  transferable `ArrayBuffer`.
 *
 *  `callHost` is captured from the open job's context. Host-call ids
 *  live in their own worker-realm counter, independent of job ids, so
 *  later `load-frame` jobs legally keep reading through the same
 *  captured function. */
class MainThreadBlobSource implements TrajectorySource {
  readonly kind = "blob" as const;
  constructor(
    private readonly totalBytes: number,
    private readonly callHost: WorkloadWorkerContext["callHost"],
  ) {}
  size(): Promise<number> {
    return Promise.resolve(this.totalBytes);
  }
  async readRange(start: number, end: number): Promise<Uint8Array> {
    const call: RequestBytes = { byteOffset: start, byteLen: end - start };
    const reply = await this.callHost(call);
    if (!(reply instanceof ArrayBuffer)) {
      throw new Error("worker: host byte reply was not an ArrayBuffer");
    }
    return new Uint8Array(reply);
  }
}

const state: WorkerState = {
  indexStream: null,
  parseStream: null,
  source: null,
  index: [],
};

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB
const PROGRESS_THROTTLE_MS = 50;

// ---------------------------------------------------------------------------
//  Job dispatch
// ---------------------------------------------------------------------------

async function dispatchJob(
  job: TrajectoryJob,
  ctx: WorkloadWorkerContext,
): Promise<{ result: TrajectoryJobResult; transfer?: Transferable[] }> {
  switch (job.kind) {
    case "open":
      return handleOpen(job, ctx);
    case "load-frame":
      return handleLoadFrame(job, ctx);
    case "close":
      return handleClose();
  }
}

installWorkloadHandler<TrajectoryJob, TrajectoryJobResult>({
  scheduling: "interleaved",
  run: dispatchJob,
});

// ---------------------------------------------------------------------------
//  Open / index pass
// ---------------------------------------------------------------------------

async function handleOpen(
  job: OpenJob,
  ctx: WorkloadWorkerContext,
): Promise<{ result: TrajectoryJobResult }> {
  state.indexStream = makeStream(job.format);
  state.parseStream = makeStream(job.format);
  state.index = [];

  state.source = await resolveSource(job.source, ctx.callHost);
  const totalBytes = await state.source.size();
  state.indexStream.hintTotalBytes?.(totalBytes);
  const fp = job.fingerprint;

  if (fp) {
    const use = decideMolidxUse(
      await OpfsIndexCache.get(fp),
      totalBytes,
      job.format,
    );
    if (use.action === "hit") {
      state.index = use.index.entries;
      return { result: openResult(totalBytes) };
    }
    if (use.action === "resume") {
      state.index = use.index.entries;
      await runIndexingPass(job, ctx, totalBytes, use.scannedBytes);
      persistIndex(fp, job.format, totalBytes, true);
      return { result: openResult(totalBytes) };
    }
  }

  await runIndexingPass(job, ctx, totalBytes, 0);
  persistIndex(fp, job.format, totalBytes, true);
  return { result: openResult(totalBytes) };
}

/** Terminal payload for a finished index scan. */
function openResult(totalBytes: number): TrajectoryJobResult {
  return {
    kind: "open-result",
    frameCount: state.index.length,
    totalBytes,
    indexComplete: true,
  };
}

async function resolveSource(
  source: SourceHandle,
  callHost: WorkloadWorkerContext["callHost"],
): Promise<TrajectorySource> {
  if (source.kind === "blob") {
    return new MainThreadBlobSource(source.totalBytes, callHost);
  }
  const handle = await OpfsBlobCache.openSync(source.filename);
  if (!handle) {
    throw new Error(`worker: opfs source '${source.filename}' not found`);
  }
  return OPFSSyncRangeSource.fromHandle(handle);
}

/** Chunked feed loop. Cooperative cancel: `ctx.isCancelled()` is polled
 *  once per chunk; on cancel the partial streams/index/source are torn
 *  down and a "cancelled" error is thrown. The runtime submits opens
 *  with `cancelMode: "reject"`, so its promises already rejected and the
 *  resulting `{type:"error"}` reply is dropped by the unknown-id rule —
 *  throwing (instead of returning a fabricated result) keeps the caller
 *  from persisting a torn-down index as complete. */
async function runIndexingPass(
  job: OpenJob,
  ctx: WorkloadWorkerContext,
  totalBytes: number,
  startAt: number,
): Promise<void> {
  if (!state.indexStream || !state.source) return;
  const chunkSize = Math.max(1, job.chunkSize ?? DEFAULT_CHUNK_SIZE);
  let bytesScanned = startAt;
  let lastProgressAt = 0;
  let announcedFirst = state.index.length >= 1;

  if (startAt > 0 && job.format === "dcd" && state.index[0]) {
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
    if (ctx.isCancelled()) {
      state.indexStream?.free?.();
      state.parseStream?.free?.();
      state.indexStream = null;
      state.parseStream = null;
      state.index = [];
      state.source?.close?.();
      state.source = null;
      throw new Error("cancelled");
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
      reportIndexProgress(ctx, bytesScanned, totalBytes);
      lastProgressAt = nowMs();
      announcedFirst = true;
      continue;
    }

    const now = nowMs();
    if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
      reportIndexProgress(ctx, bytesScanned, totalBytes);
      lastProgressAt = now;
      persistIndex(job.fingerprint, job.format, totalBytes, false);
    }
  }

  appendIndex(state.indexStream.finishIndex());
  copyDecoderContext();
}

function reportIndexProgress(
  ctx: WorkloadWorkerContext,
  bytesScanned: number,
  totalBytes: number,
): void {
  const progress: TrajectoryIndexProgress = {
    bytesScanned,
    totalBytes,
    framesIndexedSoFar: state.index.length,
  };
  ctx.reportProgress(progress);
}

/** Best-effort `.molidx` sidecar persistence — fire-and-forget; a failed
 *  write only costs the next open a rescan. No-op without a fingerprint. */
function persistIndex(
  fingerprint: string | undefined,
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

/** DCD parse needs the header the indexer already saw. Text / XTC / TRR
 *  streams return an empty context and this is a no-op. */
function copyDecoderContext(): void {
  const ctx = state.indexStream?.decoderContext?.();
  if (ctx && ctx.length > 0 && state.parseStream?.setDecoderContext) {
    state.parseStream.setDecoderContext(ctx);
  }
}

// ---------------------------------------------------------------------------
//  Load frame
// ---------------------------------------------------------------------------

/** Decode one indexed frame. Cancel is polled at the await boundary
 *  (the byte-range read); a cancelled load throws — the runtime's
 *  reject-mode promises are already settled, so the error reply is
 *  dropped host-side, and no WASM parse work happens for the stale id. */
async function handleLoadFrame(
  job: LoadFrameJob,
  ctx: WorkloadWorkerContext,
): Promise<{ result: TrajectoryJobResult; transfer: Transferable[] }> {
  if (!state.parseStream || !state.source) {
    throw new Error("worker: load-frame before open");
  }
  if (ctx.isCancelled()) {
    throw new Error("cancelled"); // pre-cancelled before any work
  }

  const pos = state.index[job.frameId];
  if (!pos) {
    throw new Error(`worker: frame ${job.frameId} out of range`);
  }

  const slice = await state.source.readRange(
    pos.byteOffset,
    pos.byteOffset + pos.byteLen,
  );
  if (ctx.isCancelled()) {
    throw new Error("cancelled");
  }

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
    frameId: job.frameId,
    blocks,
    box,
    grids,
  };
  return { result: msg, transfer: frameMessageTransferList(msg) };
}

// ---------------------------------------------------------------------------
//  Output extraction — the hot path. Every wasm call may grow memory, so
//  we re-derive views per call and copy out before the next.
// ---------------------------------------------------------------------------

function readBlocks(s: MolrsTrajStream): BlockPayload[] {
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

function readBox(s: MolrsTrajStream): BoxPayload | null {
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

function readGrids(_s: MolrsTrajStream): GridPayload[] {
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
//  Close
// ---------------------------------------------------------------------------

/** Release the WASM streams and the source. The runtime disposes its host
 *  right after submitting this job, so the `closed` reply is best-effort. */
function handleClose(): { result: TrajectoryJobResult } {
  state.indexStream?.free?.();
  state.parseStream?.free?.();
  state.indexStream = null;
  state.parseStream = null;
  state.source?.close?.();
  state.source = null;
  state.index = [];
  return { result: { kind: "closed" } };
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

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
