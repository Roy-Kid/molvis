import { describe, expect, it } from "@rstest/core";
import { act } from "react";
import { PipelineAddMenu } from "../../../../../src/ui/modes/view/pipeline/PipelineAddMenu";
import { mountComponent } from "../../../../react_harness";

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const MODIFIERS = [
  { entry: { name: "Slice", category: "Modification" }, applicable: true },
  {
    entry: { name: "Color by Property", category: "Coloring" },
    applicable: true,
  },
  {
    entry: { name: "Steinhardt order", category: "Structure identification" },
    applicable: true,
  },
];

function trigger(host: ParentNode): HTMLElement {
  const el = host.querySelector<HTMLElement>(
    '[aria-label="Add source or modifier"]',
  );
  if (!el) throw new Error("PipelineAddMenu trigger missing");
  return el;
}

function popover(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>(
    '[aria-label="Pipeline add menu"]',
  );
  if (!el) throw new Error("Pipeline add menu did not open");
  return el;
}

function wrapButton(root: ParentNode): HTMLButtonElement {
  const el = Array.from(root.querySelectorAll("button")).find((button) =>
    (button.textContent ?? "").includes("Wrap PBC"),
  );
  if (!el) throw new Error("Wrap PBC row missing");
  return el as HTMLButtonElement;
}

function searchField(root: ParentNode): HTMLInputElement {
  const el = root.querySelector<HTMLInputElement>("[data-pipeline-add-search]");
  if (!el) throw new Error("Pipeline add menu has no search field");
  return el;
}

async function typeQuery(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("No value setter on HTMLInputElement");
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("PipelineAddMenu", () => {
  it("opens a compact searchable catalog with unified group nouns", async () => {
    const { host, cleanup } = await mountComponent(
      <PipelineAddMenu
        modifiers={MODIFIERS}
        hasSources={false}
        wrapEnabled={true}
        onOpenFile={() => undefined}
        onStream={() => undefined}
        onAddModifier={() => undefined}
        onToggleWrap={() => undefined}
      />,
    );

    try {
      await act(async () => {
        trigger(host).click();
        await nextFrame();
      });

      const menu = popover();
      const text = menu.textContent ?? "";
      expect(searchField(document.body).placeholder).toBe("Search…");
      expect(text).toContain("Source");
      expect(text).toContain("Modification");
      expect(text).toContain("Color");
      expect(text).toContain("Structure");
      expect(text).toContain("Wrap PBC");
      expect(text).not.toContain("Coloring");
      expect(text).not.toContain("Structure identification");

      const wrapRow = wrapButton(menu);
      expect(wrapRow.className).toContain("min-h-control-compact");
      expect(wrapRow.className).toContain("hover:bg-accent");
      expect(wrapRow.textContent).toContain("✓");
    } finally {
      await cleanup();
    }
  });

  it("searching wrap selects Wrap PBC as a pipeline flag, not a modifier add", async () => {
    const added: string[] = [];
    const wraps: boolean[] = [];
    const { host, cleanup } = await mountComponent(
      <PipelineAddMenu
        modifiers={MODIFIERS}
        hasSources={false}
        wrapEnabled={false}
        onOpenFile={() => undefined}
        onStream={() => undefined}
        onAddModifier={(name) => added.push(name)}
        onToggleWrap={(enabled) => wraps.push(enabled)}
      />,
    );

    try {
      await act(async () => {
        trigger(host).click();
        await nextFrame();
      });

      await typeQuery(searchField(document.body), "pbc");
      const menu = popover();
      expect(menu.textContent).toContain("Wrap PBC");
      expect(menu.textContent).not.toContain("Slice");

      const wrapRow = wrapButton(menu);
      await act(async () => {
        wrapRow.click();
      });

      expect(wraps).toEqual([true]);
      expect(added).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
