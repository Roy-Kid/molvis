import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import type { MolvisApp } from "../../../src/app";
import { registerWebComponents } from "../../../src/dom_helpers";
import type { MenuItem, SceneHit } from "../../../src/mode/types";
import { ContextMenuHost } from "../../../src/ui/menus/host";

type StubApp = Pick<
  MolvisApp,
  "uiContainer" | "config" | "resolveContextMenuItems"
>;

function createStubApp(overrides?: {
  showContextMenu?: boolean;
  buildItems?: (ctx: {
    menuId: string;
    hit: SceneHit | null;
    items: readonly MenuItem[];
  }) => MenuItem[];
}): StubApp {
  const uiContainer = document.createElement("div");
  document.body.appendChild(uiContainer);

  const showContextMenu = overrides?.showContextMenu ?? true;
  const buildItems = overrides?.buildItems;

  return {
    uiContainer,
    config: {
      ui: { showContextMenu },
    } as MolvisApp["config"],
    resolveContextMenuItems(context) {
      if (!buildItems) {
        return [...context.items];
      }
      return buildItems({
        menuId: context.menuId,
        hit: context.hit,
        items: context.items,
      });
    },
  };
}

function asApp(stub: StubApp): MolvisApp {
  return stub as unknown as MolvisApp;
}

function menuEl(menuId: string): HTMLElement | null {
  return document.getElementById(menuId);
}

/** Wait for Host's setTimeout(0) document-listener registration. */
function flushOpen(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ContextMenuHost", () => {
  let stubs: StubApp[] = [];

  beforeEach(() => {
    registerWebComponents();
    stubs = [];
  });

  afterEach(() => {
    for (const s of stubs) {
      s.uiContainer.remove();
    }
    stubs = [];
    for (const id of [
      "test-menu-a",
      "test-menu-b",
      "test-menu-ignore",
      "test-menu-gate",
      "test-menu-esc",
      "test-menu-btn",
    ]) {
      document.getElementById(id)?.remove();
    }
  });

  function track(stub: StubApp): StubApp {
    stubs.push(stub);
    return stub;
  }

  it("shows a menu and registers the element under uiContainer", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-a");
    const shown = host.show(10, 20, [
      { type: "button", title: "Hello", action: () => {} },
    ]);
    expect(shown).toBe(true);
    expect(host.isVisible).toBe(true);
    const el = menuEl("test-menu-a");
    expect(el).not.toBeNull();
    expect(app.uiContainer.contains(el)).toBe(true);
    expect(el!.style.display).toBe("block");
    host.dispose();
  });

  it("enforces registry mutual exclusion between two hosts", async () => {
    const app = track(createStubApp());
    const a = new ContextMenuHost(asApp(app), "test-menu-a");
    const b = new ContextMenuHost(asApp(app), "test-menu-b");
    const item = (title: string): MenuItem => ({
      type: "button",
      title,
      action: () => {},
    });

    expect(a.show(0, 0, [item("A")])).toBe(true);
    expect(a.isVisible).toBe(true);

    expect(b.show(0, 0, [item("B")])).toBe(true);
    expect(b.isVisible).toBe(true);
    expect(a.isVisible).toBe(false);
    expect(menuEl("test-menu-a")!.style.display).toBe("none");
    expect(menuEl("test-menu-b")!.style.display).toBe("block");

    a.dispose();
    b.dispose();
  });

  it("dismisses on outside click after open", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-a");
    host.show(5, 5, [{ type: "button", title: "X", action: () => {} }]);
    await flushOpen();

    document.body.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(host.isVisible).toBe(false);
    host.dispose();
  });

  it("does not dismiss when click is on ignoreCloseTargets", async () => {
    const app = track(createStubApp());
    const panel = document.createElement("div");
    document.body.appendChild(panel);
    const host = new ContextMenuHost(asApp(app), "test-menu-ignore", {
      ignoreCloseTargets: () => [panel],
    });
    host.show(5, 5, [{ type: "button", title: "X", action: () => {} }]);
    await flushOpen();

    panel.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(host.isVisible).toBe(true);

    host.dispose();
    panel.remove();
  });

  it("hides on Escape", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-esc");
    host.show(5, 5, [{ type: "button", title: "X", action: () => {} }]);
    await flushOpen();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(host.isVisible).toBe(false);
    host.dispose();
  });

  it("hides after button action", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-btn");
    let clicked = 0;
    host.show(5, 5, [
      {
        type: "button",
        title: "Go",
        action: () => {
          clicked += 1;
        },
      },
    ]);
    await flushOpen();

    const row = menuEl("test-menu-btn")?.shadowRoot?.querySelector(
      ".row.is-action",
    ) as HTMLElement;
    expect(row).not.toBeNull();
    row.click();

    expect(clicked).toBe(1);
    expect(host.isVisible).toBe(false);
    host.dispose();
  });

  it("does not show a label-only menu", () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-a");
    const shown = host.show(1, 1, [{ type: "label", title: "C 12" }]);
    expect(shown).toBe(false);
    expect(host.isVisible).toBe(false);
    host.dispose();
  });

  it("no-ops when showContextMenu is false", () => {
    const app = track(createStubApp({ showContextMenu: false }));
    const host = new ContextMenuHost(asApp(app), "test-menu-gate");
    const shown = host.show(1, 1, [
      { type: "button", title: "Nope", action: () => {} },
    ]);
    expect(shown).toBe(false);
    expect(host.isVisible).toBe(false);
    expect(menuEl("test-menu-gate")).toBeNull();
    host.dispose();
  });

  it("forwards menuId and hit into resolveContextMenuItems", () => {
    let seenMenuId = "";
    let seenHit: SceneHit | null = null;
    const app = track(
      createStubApp({
        buildItems: ({ menuId, hit, items }) => {
          seenMenuId = menuId;
          seenHit = hit;
          return [...items];
        },
      }),
    );
    const host = new ContextMenuHost(asApp(app), "test-menu-a");
    const hit: SceneHit = { type: "empty" };
    host.show(0, 0, [{ type: "button", title: "Y", action: () => {} }], {
      hit,
    });
    expect(seenMenuId).toBe("test-menu-a");
    expect(seenHit).toBe(hit);
    host.dispose();
  });

  it("renders checked mark and does not fire disabled actions", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-btn");
    let disabledClicks = 0;
    let enabledClicks = 0;
    host.show(5, 5, [
      {
        type: "button",
        title: "On",
        checked: true,
        action: () => {
          enabledClicks += 1;
        },
      },
      {
        type: "button",
        title: "No",
        disabled: true,
        action: () => {
          disabledClicks += 1;
        },
      },
    ]);
    await flushOpen();

    const rows =
      menuEl("test-menu-btn")?.shadowRoot?.querySelectorAll<HTMLElement>(
        ".row.is-action",
      );
    expect(rows?.length).toBe(2);
    expect(rows![0].querySelector(".check")?.textContent).toBe("✓");

    rows![1].click();
    expect(disabledClicks).toBe(0);
    expect(host.isVisible).toBe(true);

    rows![0].click();
    expect(enabledClicks).toBe(1);
    expect(host.isVisible).toBe(false);
    host.dispose();
  });

  it("renders identity as a label row in the same shadow tree", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-btn");
    host.show(5, 5, [
      { type: "label", title: "C 12" },
      { type: "separator" },
      { type: "button", title: "Select", action: () => {} },
    ]);
    await flushOpen();

    const root = menuEl("test-menu-btn")?.shadowRoot;
    expect(root?.querySelector(".row.is-label .label")?.textContent).toBe(
      "C 12",
    );
    expect(root?.querySelectorAll(".row.is-action")).toHaveLength(1);
    expect(root?.querySelector("molvis-button")).toBeNull();
    host.dispose();
  });

  it("opens a flyout on folder click and activates the child", async () => {
    const app = track(createStubApp());
    const host = new ContextMenuHost(asApp(app), "test-menu-btn");
    let chosen = "";
    host.show(5, 5, [
      {
        type: "folder",
        title: "Bond",
        items: [
          {
            type: "button",
            title: "Single",
            checked: true,
            action: () => {
              chosen = "1";
            },
          },
          {
            type: "button",
            title: "Double",
            checked: false,
            action: () => {
              chosen = "2";
            },
          },
        ],
      },
    ]);
    await flushOpen();

    const root = menuEl("test-menu-btn")?.shadowRoot;
    const folder = root?.querySelector(".row.is-folder") as HTMLElement;
    expect(folder.querySelector(".meta")?.textContent).toBe("Single");
    folder.click();

    const flyout = root?.querySelector(".flyout") as HTMLElement;
    expect(flyout.classList.contains("is-open")).toBe(true);
    const double = Array.from(
      flyout.querySelectorAll<HTMLElement>(".row.is-action"),
    ).find((row) => row.querySelector(".label")?.textContent === "Double");
    expect(double).toBeDefined();
    double?.click();
    expect(chosen).toBe("2");
    expect(host.isVisible).toBe(false);
    host.dispose();
  });
});
