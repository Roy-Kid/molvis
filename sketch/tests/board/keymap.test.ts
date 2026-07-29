import { describe, expect, it } from "@rstest/core";
import { resolveKeymap } from "../../src/board/keymap";

describe("resolveKeymap", () => {
  it("maps undo redo delete escape bond order elements", () => {
    expect(resolveKeymap({ key: "z", metaKey: true })).toEqual({
      type: "undo",
    });
    expect(resolveKeymap({ key: "z", metaKey: true, shiftKey: true })).toEqual({
      type: "redo",
    });
    expect(resolveKeymap({ key: "y", ctrlKey: true })).toEqual({
      type: "redo",
    });
    expect(resolveKeymap({ key: "Delete" })).toEqual({ type: "delete" });
    expect(resolveKeymap({ key: "Escape" })).toEqual({ type: "cancel" });
    expect(resolveKeymap({ key: "1" })).toEqual({
      type: "bondOrder",
      order: 1,
    });
    expect(resolveKeymap({ key: "c" })).toEqual({
      type: "element",
      symbol: "C",
    });
  });
});
