import { type Box, Frame } from "@molcrafts/molrs";
import type { DatasetExploration } from "./analysis/exploration";
import type { EventEmitter, MolvisEventMap } from "./events";
import { Trajectory } from "./system/trajectory";
import { logger } from "./utils/logger";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
export class System {
  private _trajectory: Trajectory;
  private _exploration: DatasetExploration | null = null;
  private _frameLabels: Map<string, Float64Array> | null = null;
  private events?: EventEmitter<MolvisEventMap>;

  constructor(events?: EventEmitter<MolvisEventMap>) {
    this.events = events;
    this._trajectory = new Trajectory([new Frame()]);
    logger.info("[System] Initialized with empty frame");
  }

  /**
   * Get the current Trajectory.
   */
  get trajectory(): Trajectory {
    return this._trajectory;
  }

  /**
   * Set the current Trajectory.
   *
   * Invalidates any cached `DatasetExploration` (PCA/k-means result) by
   * emitting `exploration-change(null)` BEFORE `trajectory-change`. The
   * `frameLabels` slot is **not** auto-cleared here — the loader is
   * responsible for replacing it via `setFrameLabels()` on the new frames.
   */
  set trajectory(value: Trajectory) {
    this.setExploration(null);
    this._trajectory = value;
    logger.info(`[System] Trajectory set with ${value.length} frames`);
    this.events?.emit("trajectory-change", value);
    this.events?.emit("frame-change", this._trajectory.currentIndex);
  }

  /**
   * Get the current cached dataset exploration (PCA/k-means result), if any.
   */
  get exploration(): DatasetExploration | null {
    return this._exploration;
  }

  /**
   * Get the current per-frame numeric label map, if any.
   *
   * Keys are label names; values are `Float64Array(nFrames)` columns.
   * Missing-per-frame values are stored as `NaN`.
   */
  get frameLabels(): Map<string, Float64Array> | null {
    return this._frameLabels;
  }

  /**
   * Replace the cached dataset exploration.
   *
   * Emits `exploration-change` on reference change; no-op when the incoming
   * value is the same object (identity guard).
   */
  public setExploration(next: DatasetExploration | null): void {
    if (this._exploration === next) return;
    this._exploration = next;
    this.events?.emit("exploration-change", next);
  }

  /**
   * Replace the per-frame numeric label map.
   *
   * Emits `frame-labels-change` on reference change; no-op when the incoming
   * value is the same object (identity guard). The loader calls this after
   * aggregating `frame.meta` across a newly loaded trajectory.
   */
  public setFrameLabels(next: Map<string, Float64Array> | null): void {
    if (this._frameLabels === next) return;
    this._frameLabels = next;
    this.events?.emit("frame-labels-change", next);
  }

  /**
   * Get the current Frame (from the active trajectory).
   */
  get frame(): Frame {
    return this._trajectory.currentFrame;
  }

  /**
   * Get the current Box (from the active trajectory).
   */
  get box(): Box | undefined {
    return this._trajectory.currentBox;
  }

  /**
   * Set the current Frame.
   * This wraps the single frame in a new, single-frame Trajectory.
   */
  set frame(value: Frame | null) {
    this.setFrame(value ?? new Frame());
  }

  /**
   * Set the current Frame and optional Box.
   * Wraps them in a new, single-frame Trajectory.
   *
   * Invalidates any cached `DatasetExploration` before emitting structural
   * events, matching the contract of the `trajectory` setter.
   */
  public setFrame(frame: Frame, box?: Box): void {
    this.setExploration(null);
    const oldLen = this._trajectory.length;
    this._trajectory = new Trajectory([frame], [box]);

    const atomsBlock = frame.getBlock("atoms");
    const bondsBlock = frame.getBlock("bonds");
    const atomCount = atomsBlock?.nrows() ?? 0;
    const bondCount = bondsBlock?.nrows() ?? 0;
    logger.info(
      `[System] Frame set (wrapped in Trajectory) with ${atomCount} atoms and ${bondCount} bonds`,
    );

    if (oldLen > 1 || this._trajectory.length > 1) {
      this.events?.emit("trajectory-change", this._trajectory);
    }
    this.events?.emit("frame-change", 0);
  }

  /**
   * Update the currently active frame content without resetting the trajectory structure.
   * Useful for visual updates (e.g. Modifiers) that don't change the dataset structure.
   */
  public updateCurrentFrame(frame: Frame, box?: Box): void {
    const currentIndex = this._trajectory.currentIndex;
    if (this._trajectory.replaceFrame(currentIndex, frame, box)) {
      this.events?.emit("frame-change", currentIndex);
    } else {
      this.setFrame(frame, box);
    }
  }

  // Navigation wrappers to ensure events are emitted

  public nextFrame(): boolean {
    if (this._trajectory.next()) {
      this.events?.emit("frame-change", this._trajectory.currentIndex);
      return true;
    }
    return false;
  }

  public prevFrame(): boolean {
    if (this._trajectory.prev()) {
      this.events?.emit("frame-change", this._trajectory.currentIndex);
      return true;
    }
    return false;
  }

  public seekFrame(index: number): boolean {
    if (this._trajectory.seek(index)) {
      this.events?.emit("frame-change", this._trajectory.currentIndex);
      return true;
    }
    return false;
  }
}
