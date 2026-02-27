import { type Box, Frame } from "@molcrafts/molrs";
import { logger } from "./utils/logger";
import { Trajectory } from "./system/trajectory";
import type { EventEmitter, MolvisEventMap } from "./events";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
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
   * Set the current Frame.
   * This wraps the single frame in a new, single-frame Trajectory.
   */
  set frame(value: Frame | null) {
    this.setFrame(value ?? new Frame());
  }

  /**
   * Set the current Frame and optional Box.
   * Wraps them in a new, single-frame Trajectory.
   */
  public setFrame(frame: Frame, box?: Box): void {
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
