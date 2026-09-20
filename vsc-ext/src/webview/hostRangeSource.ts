/**
 * Webview-side range source. Implements the injected face
 * {@link HostRangeSource} expects: `size` + `readRange` over postMessage.
 *
 * Ranges are half-open `[start, end)` in **bytes**. Late `bytes` for an
 * unknown `fetchId` are ignored.
 */

import type { WebviewToHostMessage } from "../protocol";

/**
 * Coerce a host `bytes` payload into a packed `Uint8Array`.
 *
 * VS Code IPC sometimes delivers `ArrayBuffer`, a `Buffer` JSON shape
 * `{ type: "Buffer", data: number[] }`, or a view onto a pooled buffer.
 * Anything else is `null` so the caller can fail the fetch instead of
 * hanging the worker.
 */
export function asHostBytes(data: unknown): Uint8Array | null {
  if (data == null) return null;
  if (data instanceof Uint8Array) {
    return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data
      : data.slice();
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(
      view.buffer,
      view.byteOffset,
      view.byteLength,
    ).slice();
  }
  if (typeof data === "object") {
    const rec = data as { type?: unknown; data?: unknown };
    if (rec.type === "Buffer" && Array.isArray(rec.data)) {
      return Uint8Array.from(rec.data as number[]);
    }
  }
  return null;
}

export class WebviewHostRangeSource {
  readonly kind = "host" as const;
  private nextFetchId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (data: Uint8Array) => void;
      reject: (err: Error) => void;
    }
  >();

  constructor(
    private readonly uri: string,
    private readonly totalBytes: number,
    private readonly post: (message: WebviewToHostMessage) => void,
  ) {}

  size(): Promise<number> {
    return Promise.resolve(this.totalBytes);
  }

  readRange(start: number, end: number): Promise<Uint8Array> {
    const fetchId = this.nextFetchId++;
    return new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(fetchId, { resolve, reject });
      this.post({
        type: "readRange",
        uri: this.uri,
        start,
        end,
        fetchId,
      } satisfies WebviewToHostMessage);
    });
  }

  /** Deliver a host `bytes` payload. Unknown fetchIds are a no-op. */
  deliver(fetchId: number, data: Uint8Array): void {
    const pending = this.pending.get(fetchId);
    if (!pending) return;
    this.pending.delete(fetchId);
    pending.resolve(data);
  }

  fail(fetchId: number, message: string): void {
    const pending = this.pending.get(fetchId);
    if (!pending) return;
    this.pending.delete(fetchId);
    pending.reject(new Error(message));
  }

  cancel(fetchId: number): void {
    const pending = this.pending.get(fetchId);
    if (!pending) return;
    this.pending.delete(fetchId);
    this.post({ type: "cancelRange", fetchId });
    pending.reject(new Error("cancelled"));
  }
}
