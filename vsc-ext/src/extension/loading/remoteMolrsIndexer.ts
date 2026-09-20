/**
 * Thin MolRS feed wrapper that runs next to the file (extension host).
 *
 * No format scanners live here — the injected stream class is the only
 * indexer. Structure / non-stream formats return `null`.
 */

import {
  canStream,
  type FileFormat,
  ingestKind,
} from "@molcrafts/molvis-stage/io/formats";

export interface RemoteIndexEntry {
  byteOffset: number;
  byteLen: number;
}

export interface RemoteMolrsStream {
  hintTotalBytes?(total: number): void;
  allocInputBuffer(len: number): number;
  feedIndexChunk(
    globalOffset: number,
    len: number,
  ): Array<{ byteOffset: number; byteLen: number }>;
  finishIndex(): Array<{ byteOffset: number; byteLen: number }>;
}

const CHUNK = 8 * 1024 * 1024;

export class RemoteMolrsIndexer {
  constructor(
    private readonly readRange: (
      start: number,
      end: number,
    ) => Promise<Uint8Array>,
    private readonly makeStream: () => RemoteMolrsStream,
    private readonly writeInto: (ptr: number, bytes: Uint8Array) => void,
  ) {}

  async index(
    format: FileFormat,
    totalBytes: number,
  ): Promise<RemoteIndexEntry[] | null> {
    if (ingestKind(format) === "structure" || !canStream(format)) {
      return null;
    }
    const stream = this.makeStream();
    stream.hintTotalBytes?.(totalBytes);
    const entries: RemoteIndexEntry[] = [];
    let offset = 0;
    while (offset < totalBytes) {
      const end = Math.min(offset + CHUNK, totalBytes);
      const slice = await this.readRange(offset, end);
      const ptr = stream.allocInputBuffer(slice.byteLength);
      this.writeInto(ptr, slice);
      entries.push(...stream.feedIndexChunk(offset, slice.byteLength));
      offset = end;
    }
    entries.push(...stream.finishIndex());
    return entries;
  }
}
