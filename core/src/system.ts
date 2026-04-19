import { type Box, Frame } from "@molcrafts/molrs";
import type { EventEmitter, MolvisEventMap } from "./events";
import { Trajectory } from "./system/trajectory";
import { logger } from "./utils/logger";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 *
 * A dataset is always a `Trajectory` — a single frame is just a
 * one-element trajectory. There is no separate "set single frame" entry
 * point; callers assign `system.trajectory = new Trajectory([frame], [box])`.
 */
export class System {
  private _trajectory: Trajectory;
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
   */
  set trajectory(value: Trajectory) {
    this._trajectory = value;
    logger.info(`[System] Trajectory set with ${value.length} frames`);
    this.events?.emit("trajectory-change", value);
    this.events?.emit("frame-change", this._trajectory.currentIndex);
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
   * Update the currently active frame content in-place without
   * reconstructing the trajectory. Used by pipeline-driven visual updates
   * (modifiers) where topology stays fixed. Falls back to replacing the
   * trajectory when the index is out of range (empty trajectory).
   */
  public updateCurrentFrame(frame: Frame, box?: Box): void {
    const currentIndex = this._trajectory.currentIndex;
    if (this._trajectory.replaceFrame(currentIndex, frame, box)) {
      this.events?.emit("frame-change", currentIndex);
    } else {
      this.trajectory = new Trajectory([frame], [box]);
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
