import { type Box, Frame } from "@molcrafts/molrs";
import type { DatasetExploration } from "./analysis/exploration";
import type { EventEmitter, MolvisEventMap } from "./events";
import { aggregateFrameLabels } from "./system/frame_labels";
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
  private _frameLabels: Map<string, Float64Array> | null = null;
  private _exploration: DatasetExploration | null = null;
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
   * Rebuilds the per-frame label cache and invalidates any stale exploration
   * **before** `trajectory-change` fires, so listeners observe consistent
   * state. Lazy (provider-backed) trajectories skip aggregation to preserve
   * on-demand frame loading — their `frameLabels` stay null.
   */
  set trajectory(value: Trajectory) {
    this._trajectory = value;
    logger.info(`[System] Trajectory set with ${value.length} frames`);
    this.setFrameLabels(value.isLazy ? null : aggregateFrameLabels(value));
    this.setExploration(null);
    this.events?.emit("trajectory-change", value);
    this.events?.emit("frame-change", this._trajectory.currentIndex);
  }

  /**
   * Per-frame numeric descriptors aggregated from `frame.meta` at load time,
   * or null for lazy trajectories / datasets without labels.
   */
  get frameLabels(): Map<string, Float64Array> | null {
    return this._frameLabels;
  }

  /**
   * The most recent dataset exploration (PCA + optional clustering), or null
   * when none has been computed for the current trajectory.
   */
  get exploration(): DatasetExploration | null {
    return this._exploration;
  }

  /** Replace the frame-label cache. Identity-guarded; emits on change. */
  public setFrameLabels(next: Map<string, Float64Array> | null): void {
    if (this._frameLabels === next) return;
    this._frameLabels = next;
    this.events?.emit("frame-labels-change", next);
  }

  /** Replace the current exploration. Identity-guarded; emits on change. */
  public setExploration(next: DatasetExploration | null): void {
    if (this._exploration === next) return;
    this._exploration = next;
    this.events?.emit("exploration-change", next);
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
