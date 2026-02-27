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
      logger.info(
        `[Trajectory] Initialized with ${this._length} frames`,
      );
    }
  }

  /**
   * Create a Trajectory backed by a lazy FrameProvider.
   * Frames are loaded on demand instead of all at once.
   */
  static fromProvider(provider: FrameProvider, boxes: (Box | undefined)[] = []): Trajectory {
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
    return this._boxes[this._currentIndex] ?? this._getFrame(this._currentIndex)?.simbox;
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
    if (
      this._length === 0 ||
      this._currentIndex >= this._length - 1
    ) {
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
   * Replace a frame at the specified index.
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
