import * as assert from "assert";
import {
  hostSurfaceOf,
  isQuickViewHostMessage,
  PAGE_SURFACES,
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
      "loadPhase",
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

  test("PAGE_SURFACES names both chrome states", () => {
    assert.deepStrictEqual([...PAGE_SURFACES], ["full", "canvas"]);
  });

  test("hostSurfaceOf reads the surface an init declares", () => {
    assert.strictEqual(
      hostSurfaceOf({ type: "init", surface: "canvas" }),
      "canvas",
    );
    assert.strictEqual(
      hostSurfaceOf({ type: "init", surface: "full" }),
      "full",
    );
  });

  test("hostSurfaceOf returns null when no surface is declared", () => {
    // Silence means "leave the surface alone", not "default to full".
    assert.strictEqual(hostSurfaceOf({ type: "init" }), null);
    // Only `init` carries the claim.
    assert.strictEqual(
      hostSurfaceOf({
        type: "applySettings",
        surface: "canvas",
      } as never),
      null,
    );
  });

  test("hostSurfaceOf rejects a value outside the union", () => {
    assert.strictEqual(
      hostSurfaceOf({ type: "init", surface: "compact" } as never),
      null,
    );
  });

  test("the Quick look guard already admits init, so page needs no second list", () => {
    // The surface rides `init` rather than a message of its own precisely
    // because this is true. Narrow the Quick look set and this goes red.
    assert.strictEqual(
      isQuickViewHostMessage({ type: "init", surface: "canvas" }),
      true,
    );
  });
});
