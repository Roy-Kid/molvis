import {
  type Frame,
  MSDAccumulator as WasmMSD,
} from "@molcrafts/molvis-core/molrs";

export interface MsdFrameResult {
  /** System-average MSD in angstrom^2. */
  mean: number;
}

export interface MsdResult {
  /** Per-frame MSD results (index 0 = reference frame, always ~0). */
  frames: MsdFrameResult[];
  /** Number of frames processed. */
  count: number;
}

/** Plain payload of `MSDAccumulator.finalize()`. */
interface MsdStreamOut {
  direct: number[];
  windowed: number[];
  window: number;
  nFrames: number;
}

/**
 * Streaming MSD (Mean Squared Displacement) analyzer.
 *
 * Feed frames sequentially — the first frame becomes the reference.
 * All computation is delegated to WASM.
 *
 * @example
 * ```ts
 * const analyzer = new MsdAnalyzer();
 * for (const frame of trajectory) {
 *   analyzer.feed(frame);
 * }
 * const result = analyzer.result();
 * analyzer.dispose();
 * ```
 */
export class MsdAnalyzer {
  private inner: WasmMSD;

  constructor() {
    this.inner = new WasmMSD();
  }

  /** Feed a frame. First frame becomes reference. */
  feed(frame: Frame, atomIndices?: readonly number[]): void {
    const group = atomIndices ? Uint32Array.from(atomIndices) : undefined;
    this.inner.feed(frame, group);
  }

  /** Number of frames fed so far. */
  get count(): number {
    return this.inner.nFrames;
  }

  /** Get accumulated results. */
  result(): MsdResult {
    const out = this.inner.finalize() as MsdStreamOut;
    const frames: MsdFrameResult[] = out.direct.map((mean) => ({ mean }));
    return { frames, count: out.nFrames };
  }

  /** Reset analyzer (clear reference and results). */
  reset(): void {
    this.inner.reset();
  }

  /** Free WASM resources. */
  dispose(): void {
    this.inner.free();
  }
}

/**
 * Compute MSD for an array of frames (convenience wrapper).
 *
 * @param frames - Array of frames. frames[0] is the reference.
 * @returns MSD result with per-frame mean and per-particle values.
 */
export function computeMsd(
  frames: Frame[],
  atomIndicesByFrame?: readonly (readonly number[] | undefined)[],
): MsdResult | null {
  if (frames.length < 2) return null;

  const analyzer = new MsdAnalyzer();
  try {
    for (let i = 0; i < frames.length; i++) {
      analyzer.feed(frames[i], atomIndicesByFrame?.[i]);
    }
    return analyzer.result();
  } finally {
    analyzer.dispose();
  }
}
