import type { MolvisApp } from "../app";
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
   * Export menu item - emits `export-requested`. The host UI registers a
   * handler (page or vsc-ext) and owns the actual file-write. Core never
   * touches the writer.
   */
  static export(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Export",
      action: () => {
        app.events.emit("export-requested", undefined);
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
