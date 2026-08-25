import type { AbstractMesh } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import { CommonMenuItems } from "../../src/mode/menu_items";
import type { SceneHit } from "../../src/mode/types";

function atomHit(atomId: number, element: string): SceneHit {
  return {
    type: "atom",
    mesh: {} as AbstractMesh,
    metadata: {
      type: "atom",
      atomId,
      element,
      position: { x: 0, y: 0, z: 0 },
    },
    thinInstanceIndex: 0,
  };
}

describe("CommonMenuItems", () => {
  it("renders hit identity as a label, not a disabled button", () => {
    const item = CommonMenuItems.hitLabel(atomHit(12, "C"));
    expect(item).toEqual({ type: "label", title: "C 12" });
  });

  it("builds a radio folder with the current value checked", () => {
    let chosen: string | number | undefined;
    const folder = CommonMenuItems.radioFolder(
      "Bond",
      [
        { text: "Single", value: 1 },
        { text: "Double", value: 2 },
      ],
      2,
      (value) => {
        chosen = value;
      },
    );
    expect(folder.type).toBe("folder");
    if (folder.type !== "folder") return;
    expect(folder.title).toBe("Bond");
    expect(folder.items).toHaveLength(2);
    const [single, double] = folder.items;
    expect(single).toMatchObject({
      type: "button",
      title: "Single",
      checked: false,
    });
    expect(double).toMatchObject({
      type: "button",
      title: "Double",
      checked: true,
    });
    if (double.type === "button") double.action();
    expect(chosen).toBe(2);
  });

  it("prepends the current element when it is not in the common set", () => {
    const folder = CommonMenuItems.elementFolder("Fe", () => {});
    expect(folder.type).toBe("folder");
    if (folder.type !== "folder") return;
    const titles = folder.items
      .filter((item) => item.type === "button")
      .map((item) => item.title);
    expect(titles[0]).toBe("Fe");
    expect(titles).toContain("C");
  });
});
