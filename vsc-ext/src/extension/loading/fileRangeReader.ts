/**
 * Positional file read for VS Code `file:` URIs.
 *
 * `read` is a half-open byte range `[start, end)`. `cancel` aborts an
 * in-flight read keyed by the webview `fetchId`.
 */

import { promises as fs } from "node:fs";

export class FileRangeReader {
  private readonly pending = new Map<number, AbortController>();

  /**
   * Read `[start, end)` from `absPath` (bytes).
   */
  async read(
    absPath: string,
    start: number,
    end: number,
    fetchId: number,
  ): Promise<Uint8Array> {
    if (end < start) {
      throw new Error(
        `FileRangeReader: end ${end} is before start ${start} (bytes)`,
      );
    }
    const ac = new AbortController();
    this.pending.set(fetchId, ac);
    try {
      if (ac.signal.aborted) {
        throw new Error("cancelled");
      }
      const handle = await fs.open(absPath, "r");
      try {
        if (ac.signal.aborted) {
          throw new Error("cancelled");
        }
        const length = end - start;
        const buf = Buffer.alloc(length);
        const read = handle.read(buf, 0, length, start);
        const cancelled = new Promise<never>((_, reject) => {
          ac.signal.addEventListener(
            "abort",
            () => reject(new Error("cancelled")),
            { once: true },
          );
        });
        const { bytesRead } = await Promise.race([read, cancelled]);
        return new Uint8Array(buf.subarray(0, bytesRead));
      } finally {
        await handle.close();
      }
    } finally {
      this.pending.delete(fetchId);
    }
  }

  cancel(fetchId: number): void {
    this.pending.get(fetchId)?.abort();
  }
}
