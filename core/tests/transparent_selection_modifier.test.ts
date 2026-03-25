import { Block, Frame } from "@molcrafts/molrs";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { TransparentSelectionModifier } from "../src/modifiers/TransparentSelectionModifier";
import { SelectionMask, createDefaultContext } from "../src/pipeline/types";

function makeFrame(elements: string[]): Frame {
  const frame = new Frame();
  const atoms = new Block();
  atoms.setColF32("x", new Float32Array(elements.length));
  atoms.setColF32("y", new Float32Array(elements.length));
  atoms.setColF32("z", new Float32Array(elements.length));
  atoms.setColStr("element", elements);
  frame.insertBlock("atoms", atoms);
  return frame;
}

describe("TransparentSelectionModifier", () => {
  it("should pass through when selection is empty", () => {
    const mod = new TransparentSelectionModifier();
    const frame = makeFrame(["C", "O"]);
    const ctx = createDefaultContext(frame);
    // Default context has all atoms selected; set to none for this test
    ctx.currentSelection = SelectionMask.none(2);
    expect(mod.apply(frame, ctx)).toBe(frame);
    expect(ctx.postRenderEffects).toHaveLength(0);
  });

  it("should register a post-render effect for selected atoms", () => {
    const mod = new TransparentSelectionModifier();
    mod.opacity = 0.25;

    const frame = makeFrame(["C", "O", "N"]);
    const ctx = createDefaultContext(frame);
    ctx.currentSelection = SelectionMask.fromIndices(3, [1]);
    const result = mod.apply(frame, ctx);

    // Frame is returned unchanged — GPU alpha is patched via postRenderEffect
    expect(result).toBe(frame);
    expect(ctx.postRenderEffects).toHaveLength(1);
  });

  it("should expose selectedCount after apply", () => {
    const mod = new TransparentSelectionModifier();
    mod.opacity = 0.4;

    const frame = makeFrame(["C", "O", "N"]);
    const ctx = createDefaultContext(frame);
    ctx.currentSelection = SelectionMask.fromIndices(3, [0, 2]);
    mod.apply(frame, ctx);

    expect(mod.selectedCount).toBe(2);
    expect(mod.opacity).toBe(0.4);
  });

  it("should preserve frame when bonds present", () => {
    const frame = makeFrame(["C", "O"]);
    const bonds = new Block();
    bonds.setColU32("i", new Uint32Array([0]));
    bonds.setColU32("j", new Uint32Array([1]));
    frame.insertBlock("bonds", bonds);

    const mod = new TransparentSelectionModifier();
    const ctx = createDefaultContext(frame);
    ctx.currentSelection = SelectionMask.fromIndices(2, [0]);
    const result = mod.apply(frame, ctx);

    expect(result).toBe(frame);
    expect(result.getBlock("bonds")).not.toBeNull();
  });

  it("should report selectedCount 0 before first apply", () => {
    const mod = new TransparentSelectionModifier();
    expect(mod.selectedCount).toBe(0);
  });
});
