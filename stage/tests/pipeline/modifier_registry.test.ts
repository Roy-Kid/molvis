import { describe, expect, it } from "@rstest/core";
import { DrawAtomModifier } from "../../src/pipeline/draw_atom";
import { DrawBondModifier } from "../../src/pipeline/draw_bond";
import { DrawBoxModifier } from "../../src/pipeline/draw_box";
import { DrawIsosurfaceModifier } from "../../src/pipeline/draw_isosurface";
import { DrawRibbonModifier } from "../../src/pipeline/draw_ribbon";
import { ModifierRegistry } from "../../src/pipeline/modifier_registry";

describe("ModifierRegistry — OVITO-aligned menu", () => {
  it("registers defaults once and exposes user-addable subset", () => {
    ModifierRegistry.initialize();

    const all = ModifierRegistry.getAvailableModifiers();
    const menu = ModifierRegistry.getUserAddableModifiers();

    const allNames = new Set(all.map((e) => e.name));
    const menuNames = new Set(menu.map((e) => e.name));

    // Auto-attach visual elements stay registered…
    expect(allNames.has(DrawAtomModifier.NAME)).toBe(true);
    expect(allNames.has(DrawRibbonModifier.NAME)).toBe(true);
    expect(allNames.has(DrawIsosurfaceModifier.NAME)).toBe(true);
    expect(allNames.has("Transparent")).toBe(true);

    // …but are omitted from the Add menu.
    expect(menuNames.has(DrawAtomModifier.NAME)).toBe(false);
    expect(menuNames.has(DrawRibbonModifier.NAME)).toBe(false);
    // Create isosurface is user-addable (complex config → left panel).
    expect(menuNames.has(DrawIsosurfaceModifier.NAME)).toBe(true);
    expect(menuNames.has("Transparent")).toBe(false);

    // Visualization menu uses OVITO names (not "Draw …").
    expect(menuNames.has(DrawBoxModifier.NAME)).toBe(true);
    expect(menuNames.has(DrawBondModifier.NAME)).toBe(true);
    expect(menuNames.has("Create bonds")).toBe(true);
    expect(menuNames.has("Vector field")).toBe(true);
    expect(menuNames.has("Gaussian density surface")).toBe(true);
    expect(menuNames.has("Draw Box")).toBe(false);
    expect(menuNames.has("Draw Bonds")).toBe(false);
    expect(menuNames.has("Compute Bonds")).toBe(false);
  });

  it("places *selection* ops under Selection", () => {
    ModifierRegistry.initialize();
    const selection = ModifierRegistry.getUserAddableModifiers()
      .filter((e) => e.category === "Selection")
      .map((e) => e.name)
      .sort();
    expect(selection).toEqual([
      "Clear Selection",
      "Expand Selection",
      "Expression Select",
      "Hide Selection",
      "Invert Selection",
      "Select Type",
    ]);
  });

  it("registers OVITO Selection parity entries as user-addable", () => {
    ModifierRegistry.initialize();
    const byName = new Map(
      ModifierRegistry.getUserAddableModifiers().map((e) => [
        e.name,
        e.category,
      ]),
    );
    for (const name of [
      "Clear Selection",
      "Invert Selection",
      "Select Type",
      "Expand Selection",
    ]) {
      expect(byName.get(name)).toBe("Selection");
    }
  });

  it("uses OVITO-style categories for every menu entry", () => {
    ModifierRegistry.initialize();
    const byName = new Map(
      ModifierRegistry.getUserAddableModifiers().map((e) => [
        e.name,
        e.category,
      ]),
    );

    expect(byName.get("Expression Select")).toBe("Selection");
    expect(byName.get("Clear Selection")).toBe("Selection");
    expect(byName.get("Invert Selection")).toBe("Selection");
    expect(byName.get("Select Type")).toBe("Selection");
    expect(byName.get("Expand Selection")).toBe("Selection");
    expect(byName.get("Hide Selection")).toBe("Selection");
    expect(byName.get("Slice")).toBe("Modification");
    expect(byName.get("Wrap PBC")).toBe("Modification");
    expect(byName.get("Affine transformation")).toBe("Modification");
    expect(byName.get("Replicate")).toBe("Modification");
    expect(byName.get("Unwrap trajectories")).toBe("Modification");
    expect(byName.get("Delete Selected")).toBe("Modification");
    expect(byName.get("Hide Hydrogens")).toBe("Modification");
    expect(byName.get("Color by Property")).toBe("Coloring");
    expect(byName.get("Color by Type")).toBe("Coloring");
    expect(byName.get("Assign Color")).toBe("Coloring");
    expect(byName.get("Steinhardt order")).toBe("Coloring");
    expect(byName.get("Solid-liquid")).toBe("Coloring");
    expect(byName.get("Create bonds")).toBe("Visualization");
    expect(byName.get(DrawBoxModifier.NAME)).toBe("Visualization");
    expect(byName.get(DrawBondModifier.NAME)).toBe("Visualization");
  });
});
