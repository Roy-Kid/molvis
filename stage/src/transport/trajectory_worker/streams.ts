/**
 * MolRS constructors the trajectory worker may instantiate — the single
 * dispatch for every worker `Format`.
 *
 * Byte-range formats get a `Wasm*Stream`: frame-boundary indexing
 * (`feedIndexChunk`) and one-frame decode (`parseRangeInInput`) live only in
 * these classes. Hosts supply bytes; they must not grow a parallel scanner.
 *
 * `WasmLammpsDataStream` is a structure reader (one frame), not an N-frame
 * indexer — it is listed so `makeStream` stays the single dispatch.
 *
 * The one store format, `"mrec"`, is not a byte stream: molrs's
 * `TrajectoryReader` owns its frame index and reads the store through a
 * synchronous key host. It is listed in {@link MOLRS_STORE_READERS} so the
 * worker's format table is complete in one place.
 */

import {
  TrajectoryReader,
  WasmDcdStream,
  WasmLammpsDataStream,
  WasmLammpsDumpStream,
  WasmPdbStream,
  WasmSdfStream,
  WasmTrrStream,
  WasmXtcStream,
  WasmXyzStream,
} from "@molcrafts/molvis-core/molrs";
import type { Format, StreamFormat } from "./protocol";

/** Shared JS surface of every `Wasm*Stream`. */
export type MolrsTrajStream = {
  allocInputBuffer(len: number): number;
  feedIndexChunk(
    globalOffset: number,
    len: number,
  ): Array<{ byteOffset: number; byteLen: number }>;
  finishIndex(): Array<{ byteOffset: number; byteLen: number }>;
  parseRangeInInput(offset: number, len: number): void;
  releaseFrame(): void;
  blockCount(): number;
  blockName(blockIdx: number): string;
  columnCount(blockIdx: number): number;
  columnName(blockIdx: number, colIdx: number): string;
  columnDtype(blockIdx: number, colIdx: number): string;
  columnLen(blockIdx: number, colIdx: number): number;
  columnPtrF64(blockIdx: number, colIdx: number): number;
  columnPtrU32(blockIdx: number, colIdx: number): number;
  columnPtrI32(blockIdx: number, colIdx: number): number;
  columnStrings(blockIdx: number, colIdx: number): string[];
  boxH(): Float64Array | undefined;
  boxOrigin(): Float64Array | undefined;
  boxPbc(): Uint8Array | undefined;
  hintTotalBytes?(total: number): void;
  decoderContext?(): Uint8Array | undefined;
  setDecoderContext?(bytes: Uint8Array): void;
  free?(): void;
};

export const MOLRS_TRAJ_STREAMS: Record<
  StreamFormat,
  new () => MolrsTrajStream
> = {
  "lammps-dump": WasmLammpsDumpStream,
  xyz: WasmXyzStream,
  pdb: WasmPdbStream,
  lammps: WasmLammpsDataStream,
  sdf: WasmSdfStream,
  dcd: WasmDcdStream,
  xtc: WasmXtcStream,
  trr: WasmTrrStream,
};

/** Store formats: the molrs reader class that opens them. */
export const MOLRS_STORE_READERS = {
  mrec: TrajectoryReader,
} as const satisfies Record<Exclude<Format, StreamFormat>, unknown>;

/** Whether `format` opens through a store reader rather than a byte stream. */
export function isStoreFormat(
  format: Format,
): format is Exclude<Format, StreamFormat> {
  return Object.hasOwn(MOLRS_STORE_READERS, format);
}

/** Construct the MolRS stream for `format`. Never a host-local parser. */
export function makeStream(format: StreamFormat): MolrsTrajStream {
  return new MOLRS_TRAJ_STREAMS[format]();
}
