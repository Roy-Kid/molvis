import { Frame } from "molrs-wasm";
import { logger } from "../../utils/logger";

/**
 * Trajectory class manages a sequence of Frames.
 * It provides navigation methods to switch between frames.
 */
export class Trajectory {
    private _frames: Frame[];
    private _currentIndex: number;

    constructor(frames: Frame[] = []) {
        this._frames = frames;
        this._currentIndex = 0;
        if (this._frames.length > 0) {
            logger.info(`[Trajectory] Initialized with ${this._frames.length} frames`);
        }
    }

    /**
     * Get the current Frame.
     * Returns a new empty Frame if the trajectory is empty.
     */
    get currentFrame(): Frame {
        if (this._frames.length === 0) {
            return new Frame();
        }
        return this._frames[this._currentIndex];
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
        return this._frames.length;
    }

    /**
     * Add a frame to the trajectory.
     */
    addFrame(frame: Frame): void {
        this._frames.push(frame);
    }

    /**
     * Move to the next frame.
     * Clamps to the last frame.
     * Returns true if the index changed.
     */
    next(): boolean {
        if (this._frames.length === 0 || this._currentIndex >= this._frames.length - 1) {
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
        if (this._frames.length === 0 || this._currentIndex <= 0) {
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
        if (this._frames.length === 0) return false;

        let newIndex = Math.max(0, Math.min(index, this._frames.length - 1));
        if (newIndex !== this._currentIndex) {
            this._currentIndex = newIndex;
            return true;
        }
        return false;
    }
}
