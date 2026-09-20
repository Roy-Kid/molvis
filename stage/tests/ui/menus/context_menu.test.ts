import { afterEach, beforeAll, describe, expect, it } from "@rstest/core";
import { registerWebComponents } from "../../../src/dom_helpers";
import type { MenuItem } from "../../../src/mode/types";
import { MolvisContextMenu } from "../../../src/ui/menus/context_menu";

function menu(): MolvisContextMenu {
  const el = document.createElement("molvis-context-menu");
  if (!(el instanceof MolvisContextMenu)) {
    throw new TypeError("molvis-context-menu was not registered");
  }
  document.body.append(el);
  return el;
}

describe("MolvisContextMenu", () => {
  beforeAll(() => {
    registerWebComponents();
  });

  afterEach(() => {
    for (const el of document.querySelectorAll("molvis-context-menu")) {
      el.remove();
    }
  });

  it("paints rows in one shadow tree with a reserved check column", () => {
    const el = menu();
    const items: MenuItem[] = [
      { type: "label", title: "C 12" },
      { type: "separator" },
      { type: "button", title: "Select", action: () => {} },
      { type: "button", title: "Grid", checked: true, action: () => {} },
    ];
    el.show(8, 8, items);

    const root = el.shadowRoot;
    expect(root?.querySelector("molvis-button")).toBeNull();
    expect(root?.querySelector("molvis-folder")).toBeNull();
    const rows = root?.querySelectorAll(".row.is-action");
    expect(rows?.length).toBe(2);
    expect(rows![0].querySelector(".check")?.textContent).toBe("");
    expect(rows![1].querySelector(".check")?.textContent).toBe("✓");
    expect(getComputedStyle(rows![0]).display).toBe("grid");
    const labelLeft = [...root!.querySelectorAll(".label")].map(
      (node) => node.getBoundingClientRect().left,
    );
    expect(Math.max(...labelLeft) - Math.min(...labelLeft)).toBeLessThan(1);
  });

  it("shows folder current value in the meta column", () => {
    const el = menu();
    el.show(0, 0, [
      {
        type: "folder",
        title: "Distance",
        items: [
          { type: "button", title: "Å", checked: true, action: () => {} },
          { type: "button", title: "nm", checked: false, action: () => {} },
        ],
      },
    ]);
    const folder = el.shadowRoot?.querySelector(".row.is-folder");
    expect(folder?.querySelector(".label")?.textContent).toBe("Distance");
    expect(folder?.querySelector(".meta")?.textContent).toBe("Å");
    (folder as HTMLElement).click();
    const flyout = el.shadowRoot?.querySelector(".flyout");
    expect(flyout?.classList.contains("is-open")).toBe(true);
    expect(flyout?.querySelectorAll(".row.is-action")).toHaveLength(2);
  });
});
