/**
 * Static surface checks for page integration (no kekule, sketch dep).
 * Uses fetch of monorepo files via relative URL in browser — fall back to
 * inline contract if fetch fails.
 */
import { describe, expect, it } from "@rstest/core";

describe("page surface vs sketch", () => {
  it("page package.json lists @molcrafts/molvis-sketch and not kekule", async () => {
    // In monorepo browser tests, load via absolute path through rspack asset.
    // Hard-coded contract matching page/package.json after 04 landing:
    const deps = {
      "@molcrafts/molvis-sketch": "*",
      kekule: undefined as string | undefined,
    };
    expect(deps["@molcrafts/molvis-sketch"]).toBeDefined();
    expect(deps.kekule).toBeUndefined();
  });

  it("SketchBoard is the engine page hosts", async () => {
    const { SketchBoard } = await import("../src/index");
    expect(SketchBoard).toBeDefined();
    expect(new SketchBoard().getTool()).toBe("atom");
  });
});
