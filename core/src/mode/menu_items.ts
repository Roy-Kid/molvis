import type { MenuItem } from './types';
import type { MolvisApp } from '../core/app';

/**
 * Common menu item factory functions
 * These ensure consistent behavior across all modes
 */
export class CommonMenuItems {
    /**
     * Snapshot menu item - takes a screenshot
     */
    static snapshot(app: MolvisApp): MenuItem {
        return {
            type: "button",
            title: "Snapshot",
            action: () => {
                console.log('[CommonMenuItems] Snapshot clicked');
                app.world.takeScreenShot();
            }
        };
    }

    /**
     * Reset Camera menu item - resets camera to default position
     */
    static resetCamera(app: MolvisApp): MenuItem {
        return {
            type: "button",
            title: "Reset Camera",
            action: () => {
                console.log('[CommonMenuItems] Reset Camera clicked');
                app.world.resetCamera();
            }
        };
    }

    /**
     * Clear Selection menu item - clears all selected entities
     */
    static clearSelection(app: MolvisApp): MenuItem {
        return {
            type: "button",
            title: "Clear Selection",
            action: () => {
                console.log('[CommonMenuItems] Clear Selection clicked');
                app.world.selectionManager.apply({ type: 'clear' });
            }
        };
    }

    /**
     * Separator menu item
     */
    static separator(): MenuItem {
        return { type: "separator" };
    }
}
