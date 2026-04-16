import type { Frame } from "@molcrafts/molrs";
import type { FrameSource } from "../pipeline/pipeline";

/**
 * Interface matching the MolRecReader WASM class for MolRec Zarr v3 reading.
 * The concrete implementation is provided by molrs-wasm.
 */
export interface ZarrReaderLike {
  countFrames(): number;
  countAtoms(): number;
  readFrame(t: number): Frame | undefined;
  free(): void;
}

/**
 * ArrayFrameSource provides frames from an array of Frame objects.
 * Useful for in-memory trajectories or pre-loaded frames.
 */
export class ArrayFrameSource implements FrameSource {
  private frames: Frame[];

  /**
   * Wrap a preloaded list of frames as a pipeline frame source.
   */
  constructor(frames: Frame[]) {
    this.frames = frames;
  }

  async getFrame(index: number): Promise<Frame> {
    if (index < 0 || index >= this.frames.length) {
      throw new Error(
        `Frame index ${index} out of range [0, ${this.frames.length})`,
      );
    }
    return this.frames[index];
  }

  getFrameCount(): number | null {
    return this.frames.length;
  }
}

/**
 * SingleFrameSource provides a single frame.
 * Useful for static structures or single-frame visualizations.
 */
export class SingleFrameSource implements FrameSource {
  private frame: Frame;

  /**
   * Wrap a single frame as a frame source.
   */
  constructor(frame: Frame) {
    this.frame = frame;
  }

  async getFrame(_index: number): Promise<Frame> {
    // Always return the same frame regardless of index
    return this.frame;
  }

  getFrameCount(): number | null {
    return 1;
  }
}

/**
 * AsyncFrameSource provides frames from an async function.
 * Useful for lazy-loading or network-based frame providers.
 */
export class AsyncFrameSource implements FrameSource {
  private getFrameFn: (index: number) => Promise<Frame>;
  private frameCount: number | null;

  /**
   * Wrap an async callback as a frame source.
   */
  constructor(
    getFrameFn: (index: number) => Promise<Frame>,
    frameCount: number | null = null,
  ) {
    this.getFrameFn = getFrameFn;
    this.frameCount = frameCount;
  }

  async getFrame(index: number): Promise<Frame> {
    return this.getFrameFn(index);
  }

  getFrameCount(): number | null {
    return this.frameCount;
  }
}

/**
 * ZarrFrameSource provides frames from a Zarr archive.
 */
export class ZarrFrameSource implements FrameSource {
  private reader: ZarrReaderLike;
  private frameCount: number;

  /**
   * Wrap a `ZarrReaderLike` so it can drive the modifier pipeline.
   */
  constructor(reader: ZarrReaderLike) {
    this.reader = reader;
    this.frameCount = reader.countFrames();
  }

  async getFrame(index: number): Promise<Frame> {
    const frame = this.reader.readFrame(index);
    if (!frame) throw new Error(`Frame index ${index} out of range`);
    return frame;
  }

  getFrameCount(): number | null {
    return this.frameCount;
  }
}
