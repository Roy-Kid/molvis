/**
 * Webview-side range source. Implements the injected face
 * {@link HostRangeSource} expects: `size` + `readRange` over postMessage.
 *
 * Ranges are half-open `[start, end)` in **bytes**. Late `bytes` for an
 * unknown `fetchId` are ignored.
 */

import type { WebviewToHostMessage } from "../protocol";

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

  cancel(fetchId: number): void {
    const pending = this.pending.get(fetchId);
    if (!pending) return;
    this.pending.delete(fetchId);
    this.post({ type: "cancelRange", fetchId });
    pending.reject(new Error("cancelled"));
  }
}
