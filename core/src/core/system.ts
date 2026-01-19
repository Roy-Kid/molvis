import type { Frame } from "./system/frame";
import { logger } from "../utils/logger";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
export class System {
    private _currentFrame: Frame | null = null;

    /**
     * Get the current Frame.
     */
    get frame(): Frame | null {
        return this._currentFrame;
    }

    /**
     * Set the current Frame.
     */
    set frame(value: Frame | null) {
        this._currentFrame = value;
        if (value) {
            logger.info(`[System] Frame set with ${value.getAtomCount()} atoms and ${value.getBondCount()} bonds`);
        } else {
            logger.info("[System] Frame cleared");
        }
    }
}
