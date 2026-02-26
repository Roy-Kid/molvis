import type { MolvisApp } from "../core/app";
import { inferFormatFromFilename } from "../core/reader";
import { exportFrame } from "../core/writer";
import { logger } from "../utils/logger";
import type { MenuItem } from "./types";

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
      },
    };
  }

  /**
   * Export menu item - prompts for filename, syncs, writes, downloads
   */
  static export(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Export",
      action: async () => {
        const frame = app.system.frame;
        if (!frame) {
          logger.warn("[CommonMenuItems] No Frame loaded, cannot export");
          return;
        }

        try {
          const suggestedName = "molvis.pdb";
          const format = inferFormatFromFilename(suggestedName, "pdb");
          const payload = exportFrame(app.world.sceneIndex, { format, filename: suggestedName });
          const blob = new Blob([payload.content], { type: payload.mime });
          await app.saveFile(blob, payload.suggestedName);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          throw err;
        }
      },
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
      },
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
        app.world.selectionManager.apply({ type: "clear" });
      },
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
