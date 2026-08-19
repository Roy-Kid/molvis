import * as assert from "assert";
import {
  isQuickViewHostMessage,
  QUICK_VIEW_HOST_MESSAGE_TYPES,
} from "../../../src/protocol";

suite("protocol/messages", () => {
  test("QUICK_VIEW_HOST_MESSAGE_TYPES lists the core set", () => {
    assert.deepStrictEqual([...QUICK_VIEW_HOST_MESSAGE_TYPES].sort(), [
      "applySettings",
      "bytes",
      "error",
      "init",
      "loadFile",
      "openUri",
      "selectAtoms",
      "triggerSave",
    ]);
  });

  test("isQuickViewHostMessage accepts loadFile with stream", () => {
    const msg = {
      type: "loadFile",
      content: new Uint8Array([1, 2, 3]),
      filename: "traj.lammpstrj",
      format: "lammps-dump",
      stream: true,
    };
    assert.strictEqual(isQuickViewHostMessage(msg), true);
  });

  test("isQuickViewHostMessage accepts selectAtoms", () => {
    assert.strictEqual(
      isQuickViewHostMessage({ type: "selectAtoms", indices: [0] }),
      true,
    );
  });

  test("isQuickViewHostMessage rejects enableCapability", () => {
    assert.strictEqual(
      isQuickViewHostMessage({ type: "enableCapability", id: "pipeline" }),
      false,
    );
  });

  test("isQuickViewHostMessage rejects non-objects", () => {
    assert.strictEqual(isQuickViewHostMessage(null), false);
    assert.strictEqual(isQuickViewHostMessage("init"), false);
    assert.strictEqual(isQuickViewHostMessage({}), false);
  });
});
