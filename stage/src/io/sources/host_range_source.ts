import type { TrajectorySource } from "./trajectory_source";

/**
 * Byte source whose `readRange` is injected by the host (VS Code
 * `openUri` / `readRange`). The worker still sees a blob-shaped
 * `request-bytes` handle; the main thread answers from this object.
 */
export class HostRangeSource implements TrajectorySource {
  readonly kind = "host" as const;

  constructor(
    private readonly impl: {
      size(): Promise<number>;
      readRange(start: number, end: number): Promise<Uint8Array>;
    },
  ) {}

  size(): Promise<number> {
    return this.impl.size();
  }

  readRange(start: number, end: number): Promise<Uint8Array> {
    return this.impl.readRange(start, end);
  }
}
