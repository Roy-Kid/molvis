import { describe, expect, it } from "@rstest/core";
import type { MolvisApp } from "../../src/app";
import { defaultMolvisConfig } from "../../src/config";
import { GUIManager } from "../../src/ui/manager";

/** The constructor only stores its arguments; nothing here is dereferenced
 *  until `mount()`, which these cases deliberately never reach. */
function unmountedManager(): GUIManager {
  return new GUIManager(
    document.createElement("div"),
    {} as MolvisApp,
    defaultMolvisConfig({}),
  );
}

describe("GUIManager bond column picker", () => {
  it("refuses to prompt before the chrome is mounted", () => {
    expect(unmountedManager().canPrompt).toBe(false);
  });

  it("resolves null rather than hanging a load it cannot prompt for", async () => {
    // The load flow checks `canPrompt` first, so this is the belt-and-braces
    // path: a caller that skipped the check still gets a settled promise
    // instead of a load stuck forever on a modal that was never shown.
    await expect(
      unmountedManager().pickBondMapping("overlay.dump.local", ["c_1", "c_2"]),
    ).resolves.toBe(null);
  });
});
