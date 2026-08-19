import * as assert from "assert";
import { groupPathsByParent } from "../../../src/extension/loading/filesTree";

suite("filesTree", () => {
  test("groupPathsByParent returns empty for no paths", () => {
    assert.deepStrictEqual(groupPathsByParent([]), []);
  });

  test("groupPathsByParent uses '.' when there is no parent", () => {
    assert.deepStrictEqual(groupPathsByParent(["water.xyz"]), [
      { folder: ".", paths: ["water.xyz"] },
    ]);
  });

  test("groupPathsByParent groups by parent and sorts", () => {
    const groups = groupPathsByParent([
      "data/b.pdb",
      "examples/a.xyz",
      "data/a.pdb",
    ]);
    assert.deepStrictEqual(groups, [
      { folder: "data", paths: ["data/a.pdb", "data/b.pdb"] },
      { folder: "examples", paths: ["examples/a.xyz"] },
    ]);
  });

  test("groupPathsByParent normalizes Windows separators", () => {
    assert.deepStrictEqual(groupPathsByParent(["data\\frame.xyz"]), [
      { folder: "data", paths: ["data/frame.xyz"] },
    ]);
  });
});
