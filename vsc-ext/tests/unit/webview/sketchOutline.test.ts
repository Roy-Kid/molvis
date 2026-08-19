import * as assert from "assert";
import { buildSketchOutline } from "../../../src/webview/sketchOutline";

suite("sketchOutline", () => {
  test("buildSketchOutline returns empty roots for an empty board", () => {
    assert.deepStrictEqual(buildSketchOutline({ atoms: [], bonds: [] }), {
      roots: [],
    });
  });

  test("buildSketchOutline groups atoms and bonds", () => {
    const outline = buildSketchOutline({
      atoms: [{ element: "C" }, { element: "O" }],
      bonds: [{ i: 0, j: 1, order: 2 }],
    });
    assert.strictEqual(outline.roots.length, 2);
    assert.strictEqual(outline.roots[0]?.label, "Atoms");
    assert.strictEqual(outline.roots[0]?.children?.[0]?.label, "C1");
    assert.strictEqual(outline.roots[1]?.label, "Bonds");
    assert.strictEqual(outline.roots[1]?.children?.[0]?.label, "C–O (2)");
    assert.deepStrictEqual(
      outline.roots[1]?.children?.[0]?.atomIndices,
      [0, 1],
    );
  });
});
