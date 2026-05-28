import { type Box, Frame } from "@molcrafts/molrs";
import { logger } from "../utils/logger";

/**
 * Interface for lazy frame providers that load frames on demand.
 */
export interface FrameProvider {
  readonly length: number;
  get(index: number): Frame;
}

/**
 * Trajectory class manages a sequence of Frames.
 * It provides navigation methods to switch between frames.
 * Supports both eager (Frame[]) and lazy (FrameProvider) modes.
 */
export class Trajectory {
  private _frames: Frame[];
  private _boxes: (Box | undefined)[];
  private _currentIndex: number;
  private _provider?: FrameProvider;
  private _length: number;

  constructor(frames: Frame[] = [], boxes: (Box | undefined)[] = []) {
    this._frames = frames;
    this._boxes = boxes;
    this._length = frames.length;
    // Ensure boxes array matches frames length if not provided
    if (this._boxes.length < this._frames.length) {
      // Fill with undefined
      const missing = this._frames.length - this._boxes.length;
      for (let i = 0; i < missing; i++) this._boxes.push(undefined);
    }

    this._currentIndex = 0;
    if (this._length > 0) {
      logger.info(`[Trajectory] Initialized with ${this._length} frames`);
    }
  }

  /**
   * Create a Trajectory backed by a lazy FrameProvider.
   * Frames are loaded on demand instead of all at once.
   */
  static fromProvider(
    provider: FrameProvider,
    boxes: (Box | undefined)[] = [],
  ): Trajectory {
    const traj = new Trajectory([], boxes);
    traj._provider = provider;
    traj._length = provider.length;
    // Ensure boxes array matches provider length
    if (traj._boxes.length < traj._length) {
      const missing = traj._length - traj._boxes.length;
      for (let i = 0; i < missing; i++) traj._boxes.push(undefined);
    }
    if (traj._length > 0) {
      logger.info(
        `[Trajectory] Initialized lazy provider with ${traj._length} frames`,
      );
    }
    return traj;
  }

  private _getFrame(index: number): Frame {
    if (this._provider) {
      return this._provider.get(index);
    }
    return this._frames[index];
  }

  /**
   * Get the current Frame.
   * Returns a new empty Frame if the trajectory is empty.
   */
  get currentFrame(): Frame {
    if (this._length === 0) {
      return new Frame();
    }
    return this._getFrame(this._currentIndex);
  }

  /**
   * Get the current Box (if any).
   */
  get currentBox(): Box | undefined {
    if (this._length === 0) {
      return undefined;
    }
    return (
      this._boxes[this._currentIndex] ??
      this._getFrame(this._currentIndex)?.simbox
    );
  }

  /**
   * Get the current frame index.
   */
  get currentIndex(): number {
    return this._currentIndex;
  }

  /**
   * Get the total number of frames.
   */
  get length(): number {
    return this._length;
  }

  /**
   * True when frames are loaded on demand via a {@link FrameProvider}.
   * Callers that would walk every frame eagerly (e.g. frame-label
   * aggregation) skip lazy trajectories to preserve streaming behaviour.
   */
  get isLazy(): boolean {
    return this._provider !== undefined;
  }

  /**
   * Return the frame at `index`, or `undefined` if out of range.
   * Consumers that need per-frame metadata walk the trajectory via
   * this accessor — there is no separate aggregation layer.
   */
  get(index: number): Frame | undefined {
    if (index < 0 || index >= this._length) return undefined;
    return this._getFrame(index);
  }

  /**
   * Add a frame to the trajectory.
   */
  addFrame(frame: Frame, box?: Box): void {
    this._frames.push(frame);
    this._boxes.push(box);
    this._length = this._frames.length;
  }

  /**
   * Move to the next frame.
   * Clamps to the last frame.
   * Returns true if the index changed.
   */
  next(): boolean {
    if (this._length === 0 || this._currentIndex >= this._length - 1) {
      return false;
    }
    this._currentIndex++;
    return true;
  }

  /**
   * Move to the previous frame.
   * Clamps to the first frame.
   * Returns true if the index changed.
   */
  prev(): boolean {
    if (this._length === 0 || this._currentIndex <= 0) {
      return false;
    }
    this._currentIndex--;
    return true;
  }

  /**
   * Seek to a specific frame index.
   * Clamps to the valid range [0, length - 1].
   * Returns true if the index changed.
   */
  seek(index: number): boolean {
    if (this._length === 0) return false;

    const newIndex = Math.max(0, Math.min(index, this._length - 1));
    if (newIndex !== this._currentIndex) {
      this._currentIndex = newIndex;
      return true;
    }
    return false;
  }
  /**
   * Free the WASM {@link Frame} objects this trajectory owns.
   *
   * Eager trajectories own their frames' WASM linear-memory backing; dropping
   * the trajectory (e.g. on reload via `setTrajectory`) without freeing leaks
   * that memory. Call this on the *outgoing* trajectory once it is no longer
   * the active one.
   *
   * - **Lazy/provider-backed** trajectories are skipped — the provider owns
   *   frame lifetime (and reuses/evicts via its own LRU).
   * - Frames in `exclude` are still referenced elsewhere (e.g. the app's
   *   source / last-rendered frame) and are left untouched to avoid a
   *   use-after-free / double-free.
   * - Boxes are intentionally not freed here: their ownership flows into draw
   *   commands and `currentBox` falls back to `frame.simbox`, so freeing them
   *   risks a double-free. They are released with their frame.
   *
   * After `dispose()` the trajectory holds no frames and must not be reused.
   */
  dispose(exclude?: ReadonlySet<Frame>): void {
    if (this._provider) return;
    for (const frame of this._frames) {
      if (!frame || exclude?.has(frame)) continue;
      frame.free();
    }
    this._frames = [];
    this._boxes = [];
    this._length = 0;
  }

  /**
   * Replace a frame at the specified index.
   * NOTE: This mutates the trajectory in place for performance — it is called
   * on every pipeline-driven visual update. The caller (System.updateCurrentFrame)
   * relies on in-place mutation to avoid reconstructing the entire Trajectory.
   */
  replaceFrame(index: number, frame: Frame, box?: Box): boolean {
    if (index >= 0 && index < this._length) {
      this._frames[index] = frame;
      this._boxes[index] = box;
      return true;
    }
    return false;
  }
}
