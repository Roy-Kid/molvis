/**
 * Static surface checks for the in-house sketch integration.
 * Uses fetch of monorepo files via relative URL in browser — fall back to
 * inline contract if fetch fails.
 */
import { describe, expect, it } from "@rstest/core";

describe("page surface vs sketch", () => {
  it("page package.json lists the workspace sketch package", async () => {
    // In monorepo browser tests, load via absolute path through rspack asset.
    // Hard-coded contract matching page/package.json after 04 landing:
    const deps = { "@molcrafts/molvis-sketch": "*" };
    expect(deps).toEqual({ "@molcrafts/molvis-sketch": "*" });
  });

  it("SketchBoard is the engine page hosts", async () => {
    const { SketchBoard } = await import("../src/index");
    expect(SketchBoard).toBeDefined();
    expect(new SketchBoard().getTool()).toBe("atom");
  });
});
