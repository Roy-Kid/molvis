/**
 * Guards the OVITO parity matrix against registry drift.
 * Allowlist must match `.claude/notes/ovito-modifier-parity.md` "done" Add-menu rows.
 */
import { describe, expect, it } from "@rstest/core";
import { ModifierRegistry } from "../../src/pipeline/modifier_registry";

/** User-addable names currently documented as done in the parity matrix. */
const DONE_USER_ADDABLE = new Set([
  // Selection
  "Expression Select",
  "Clear Selection",
  "Invert Selection",
  "Select Type",
  "Expand Selection",
  "Select overlapping",
  "Hide Selection",
  // Modification
  "Slice",
  "Wrap PBC",
  "Affine transformation",
  "Replicate",
  "Unwrap trajectories",
  "Compute property",
  "Freeze property",
  "Edit types",
  "Displacement vectors",
  "Delete Selected",
  "Hide Hydrogens",
  // Coloring
  "Color by Property",
  "Color by Type",
  "Assign Color",
  "Steinhardt order",
  "Solid-liquid",
  // Visualization
  "Create bonds",
  "Bonds",
  "Simulation cell",
  "Vector field",
  "Gaussian density surface",
  "Construct surface mesh",
  "Coordination polyhedra",
  "Generate trajectory lines",
  "Create isosurface",
]);

describe("OVITO parity inventory", () => {
  it("every user-addable registry name is in the done allowlist", () => {
    ModifierRegistry.initialize();
    const menu = ModifierRegistry.getUserAddableModifiers();
    for (const entry of menu) {
      expect(DONE_USER_ADDABLE.has(entry.name)).toBe(true);
    }
  });

  it("done allowlist names are all registered as user-addable", () => {
    ModifierRegistry.initialize();
    const names = new Set(
      ModifierRegistry.getUserAddableModifiers().map((e) => e.name),
    );
    for (const name of DONE_USER_ADDABLE) {
      expect(names.has(name)).toBe(true);
    }
  });
});
