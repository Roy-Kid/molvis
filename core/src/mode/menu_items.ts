import type { MenuItem } from './types';
import type { MolvisApp } from '../core/app';
import { inferFormatFromFilename } from '../core/reader';
import { writeFrame } from '../core/writer';
import { syncSceneToFrame } from '../core/scene_sync';
import { logger } from "../utils/logger";

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
                app.world.takeScreenShot();
            }
        };
    }

    /**
     * Export menu item - prompts for filename, syncs, writes, downloads
     */
    static export(app: MolvisApp): MenuItem {
        return {
            type: "button",
            title: "Export",
            action: () => {
                const frame = app.system.frame;
                if (!frame) {
                    logger.warn('[CommonMenuItems] No Frame loaded, cannot export');
                    return;
                }

                const filename = window.prompt(
                    "Enter file name (e.g. model.pdb / model.xyz / model.lammps)",
                    "molvis.pdb"
                );
                if (!filename) {
                    return;
                }

                const format = inferFormatFromFilename(filename, "pdb");
                syncSceneToFrame(app.world.scene, app.world.sceneIndex, frame);

                const payload = writeFrame(frame, { format, filename });
                const blob = new Blob([payload.content], { type: payload.mime });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = payload.suggestedName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
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

    /**
     * Append export + snapshot as the final menu items.
     */
    static appendCommonTail(items: MenuItem[], app: MolvisApp): MenuItem[] {
        items.push(CommonMenuItems.export(app));
        items.push(CommonMenuItems.snapshot(app));
        return items;
    }
}
