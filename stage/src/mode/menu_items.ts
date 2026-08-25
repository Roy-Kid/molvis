import type { MolvisApp } from "../app";
import { FILE_FORMAT_REGISTRY } from "../io/formats";
import type { MenuItem, SceneHit } from "./types";

/**
 * Context-menu factories. Titles: at most two words (readable on small canvas).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: CommonMenuItems is a public API namespace with an established static call shape
export class CommonMenuItems {
  /** Copy screenshot to clipboard. */
  static snapshot(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Screenshot",
      action: () => {
        void app
          .copyScreenshotToClipboard()
          .then(() =>
            app.events.emit("status-message", {
              text: "Screenshot copied",
              type: "info",
            }),
          )
          .catch((err: unknown) =>
            app.events.emit("status-message", {
              text: `Screenshot failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
              type: "error",
            }),
          );
      },
    };
  }

  /** Export — writable formats as .ext labels. */
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

  /** Fit camera to scene (empty → default home pose). */
  static fitCamera(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Fit View",
      action: () => {
        app.world.fit();
      },
    };
  }

  /** Clear active selection content (keep list row). */
  static clearSelection(app: MolvisApp): MenuItem {
    return {
      type: "button",
      title: "Clear",
      action: () => {
        void app.clearActiveSelectionContent();
      },
    };
  }

  static hasSelection(app: MolvisApp): boolean {
    const sel = app.world.selectionManager;
    return (
      sel.getSelectedAtomIds().size > 0 || sel.getSelectedBondIds().size > 0
    );
  }

  /** Common draw-time elements. Unknown current values are prepended. */
  static elementFolder(
    current: string,
    set: (element: string) => void,
  ): MenuItem {
    const symbols = ["C", "H", "N", "O", "S", "P", "F", "Cl"];
    const options = symbols.map((text) => ({ text, value: text }));
    if (current && !symbols.includes(current)) {
      options.unshift({ text: current, value: current });
    }
    return CommonMenuItems.radioFolder("Element", options, current, (value) => {
      set(String(value));
    });
  }

  static separator(): MenuItem {
    return { type: "separator" };
  }

  static label(title: string): MenuItem {
    return { type: "label", title };
  }

  static submenu(title: string, items: MenuItem[]): MenuItem {
    return { type: "folder", title, items };
  }

  /** Radio-style submenu (current value checked). */
  static radioFolder(
    title: string,
    options: readonly { text: string; value: string | number }[],
    current: string | number,
    set: (value: string | number) => void,
  ): MenuItem {
    return CommonMenuItems.submenu(
      title,
      options.map((opt) =>
        CommonMenuItems.toggle(opt.text, opt.value === current, () => {
          set(opt.value);
        }),
      ),
    );
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
   * Hit header. Atom: "C 12"; bond: "Bond N"; ribbon: "A | ALA 42".
   */
  static hitLabel(hit: SceneHit): MenuItem | null {
    if (hit.type === "atom") {
      const el = hit.metadata.element?.trim();
      const id = hit.metadata.atomId;
      return CommonMenuItems.label(el ? `${el} ${id}` : `Atom ${id}`);
    }
    if (hit.type === "bond") {
      return CommonMenuItems.label(`Bond ${hit.metadata.bondId}`);
    }
    if (hit.type === "ribbon") {
      return CommonMenuItems.label(
        `${hit.chainId} | ${hit.resName} ${hit.resSeq}`,
      );
    }
    return null;
  }

  /** Export submenu + screenshot — always last. */
  static appendCommonTail(items: MenuItem[], app: MolvisApp): MenuItem[] {
    if (items.length > 0) items.push(CommonMenuItems.separator());
    items.push(CommonMenuItems.export(app));
    items.push(CommonMenuItems.snapshot(app));
    return items;
  }
}
