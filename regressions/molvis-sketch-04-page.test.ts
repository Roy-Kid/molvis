/**
 * Page host surface goldens (browser-safe).
 * Package dep / zero-kekule source scan is covered by sketch package
 * `tests/page_surface.test.ts` (reads JSON + sources via rspack).
 * Provenance: 2026-07-29.
 */
import { describe, expect, it } from "@rstest/core";
import { SketchBoard } from "../sketch/src/index";

describe("molvis-sketch-04-page regression", () => {
  it("SketchBoard public API is available for page MolvisSketch host", () => {
    const board = new SketchBoard();
    expect(typeof board.mount).toBe("function");
    expect(typeof board.toFrame).toBe("function");
    expect(typeof board.getMoleculeData).toBe("function");
    expect(typeof board.setTool).toBe("function");
    expect(typeof board.clear).toBe("function");
    const empty = board.getMoleculeData();
    expect(empty.atoms).toEqual([]);
  });
});
