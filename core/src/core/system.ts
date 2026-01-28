import { Frame } from "molrs-wasm";
import { logger } from "../utils/logger";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
import { Trajectory } from "./system/trajectory";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
import { EventEmitter } from "../events";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
export class System {
    private _trajectory: Trajectory;
    private events?: EventEmitter;

    constructor(events?: EventEmitter) {
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
        this.events?.emit('trajectory-change', value);
        // Also emit frame-change as we reset to start of new trajectory usually
        this.events?.emit('frame-change', this._trajectory.currentIndex);
    }

    /**
     * Get the current Frame (from the active trajectory).
     */
    get frame(): Frame {
        return this._trajectory.currentFrame;
    }

    /**
     * Set the current Frame.
     * This wraps the single frame in a new, single-frame Trajectory.
     */
    set frame(value: Frame | null) {
        const frame = value ?? new Frame();
        const oldLen = this._trajectory.length;
        this._trajectory = new Trajectory([frame]);

        if (value) {
            const atomsBlock = value.getBlock("atoms");
            const bondsBlock = value.getBlock("bonds");
            const atomCount = atomsBlock?.nrows() ?? 0;
            const bondCount = bondsBlock?.nrows() ?? 0;
            logger.info(`[System] Frame set (wrapped in Trajectory) with ${atomCount} atoms and ${bondCount} bonds`);
        } else {
            logger.info("[System] Frame reset (empty Trajectory)");
        }

        // Only emit if we actually change from a multi-frame trajectory or similar significant change
        if (oldLen > 1 || this._trajectory.length > 1) {
            this.events?.emit('trajectory-change', this._trajectory);
        }
        this.events?.emit('frame-change', 0);
    }

    // Navigation wrappers to ensure events are emitted

    public nextFrame(): boolean {
        if (this._trajectory.next()) {
            this.events?.emit('frame-change', this._trajectory.currentIndex);
            return true;
        }
        return false;
    }

    public prevFrame(): boolean {
        if (this._trajectory.prev()) {
            this.events?.emit('frame-change', this._trajectory.currentIndex);
            return true;
        }
        return false;
    }

    public seekFrame(index: number): boolean {
        if (this._trajectory.seek(index)) {
            this.events?.emit('frame-change', this._trajectory.currentIndex);
            return true;
        }
        return false;
    }
}
