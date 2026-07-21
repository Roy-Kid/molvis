import type { MolvisApp } from "../app";
import { FILE_FORMAT_REGISTRY } from "../io/formats";
import type { HitResult, MenuItem } from "./types";

/**
 * Short-label menu factories for small canvases.
 * Prefer ≤8 chars in titles when possible.
 */
export class CommonMenuItems {
  /** Shot — clipboard screenshot. */
  static snapshot(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Shot",
      action: () => {
        void app
          .copyScreenshotToClipboard()
          .then(() =>
            app.events.emit("status-message", {
              text: "Shot copied",
              type: "info",
            }),
          )
          .catch((err: unknown) =>
            app.events.emit("status-message", {
              text: `Shot failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
              type: "error",
            }),
          );
      },
    };
  }

  /** Export — writable formats as short .ext labels. */
  static export(app: MolvisApp): MenuItem {
    const formats = FILE_FORMAT_REGISTRY.filter((d) => d.writable).map((d) => ({
      format: d.format,
      label: `.${d.extensions[0]}`,
    }));
    return {
      type: "folder",
      title: "Export",
      items: formats.map(({ format, label }) => ({
        type: "button",
        title: label,
        action: () => {
          app.events.emit("export-requested", { format });
        },
      })),
    };
  }

  /** Fit — reset camera framing. */
  static resetCamera(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Fit",
      action: () => {
        app.world.resetCamera();
      },
    };
  }

  /** Clear selection. */
  static clearSelection(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Clear",
      action: () => {
        app.world.selectionManager.apply({ type: "clear" });
      },
    };
  }

  static separator(): MenuItem {
    return { type: "separator" };
  }

  static submenu(title: string, items: MenuItem[]): MenuItem {
    return { type: "folder", title, items };
  }

  /** Toggle-style button with check mark. */
  static toggle(
    title: string,
    checked: boolean,
    action: () => void,
    opts?: { disabled?: boolean; shortcut?: string },
  ): MenuItem {
    return {
      type: "button",
      title,
      checked,
      disabled: opts?.disabled,
      shortcut: opts?.shortcut,
      action,
    };
  }

  static button(
    title: string,
    action: () => void,
    opts?: { disabled?: boolean; shortcut?: string; checked?: boolean },
  ): MenuItem {
    return {
      type: "button",
      title,
      action,
      disabled: opts?.disabled,
      shortcut: opts?.shortcut,
      checked: opts?.checked,
    };
  }

  /**
   * Compact hit header (disabled label). Atom: element+id; bond: B·id.
   */
  static hitLabel(hit: HitResult): MenuItem | null {
    if (hit.type === "atom") {
      const el = hit.metadata.element ?? "?";
      const id = hit.metadata.atomId;
      return {
        type: "button",
        title: `${el}${id}`,
        disabled: true,
        action: () => {},
      };
    }
    if (hit.type === "bond") {
      return {
        type: "button",
        title: `B${hit.metadata.bondId}`,
        disabled: true,
        action: () => {},
      };
    }
    return null;
  }

  /** Append Export + Shot. */
  static appendCommonTail(items: MenuItem[], app: MolvisApp): MenuItem[] {
    items.push(CommonMenuItems.export(app));
    items.push(CommonMenuItems.snapshot(app));
    return items;
  }
}
