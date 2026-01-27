import { Frame } from "molrs-wasm";
import { logger } from "../utils/logger";

/**
 * System class manages all data and structure-related operations.
 * Parallel to World (which handles rendering), System handles data.
 */
export class System {
    private _currentFrame: Frame;

    constructor() {
        this._currentFrame = new Frame();
        logger.info("[System] Frame initialized (empty)");
    }

    /**
     * Get the current Frame.
     */
    get frame(): Frame {
        return this._currentFrame;
    }

    /**
     * Set the current Frame.
     */
    set frame(value: Frame | null) {
        this._currentFrame = value ?? new Frame();
        if (value) {
            const atomsBlock = value.get_block("atoms");
            const bondsBlock = value.get_block("bonds");
            const atomCount = atomsBlock?.nrows() ?? 0;
            const bondCount = bondsBlock?.nrows() ?? 0;
            logger.info(`[System] Frame set with ${atomCount} atoms and ${bondCount} bonds`);
        } else {
            logger.info("[System] Frame reset (empty)");
        }
    }
}
