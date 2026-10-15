import { NullEngine } from "@babylonjs/core";
import { afterEach, describe, expect, it } from "@rstest/core";
import "../setup_wasm";
import { SelectModifier } from "../../src/modifiers/SelectModifier";
import { Session } from "../../src/pipeline/session";
import { MolvisRenderer } from "../../src/renderer";

describe("manual selection beside a session", () => {
  let renderer: MolvisRenderer | undefined;

  afterEach(() => {
    renderer?.dispose();
    renderer = undefined;
  });

  function headless(): MolvisRenderer {
    const canvas = document.createElement("canvas");
    renderer = new MolvisRenderer(canvas, { engine: new NullEngine() });
    renderer.app.modifierPipeline.setSession(
      new Session("session", "ws://127.0.0.1/ws", () => {}),
    );
    return renderer;
  }

  it("returns the id the pipeline stored, not the session's NATO name", () => {
    const app = headless().app;
    const sessionId = app.modifierPipeline.session()?.id;

    const id = app.createManualSelection([7]);

    expect(id).not.toBe(sessionId);
    expect(app.activeSelectionId).toBe(id);
    const stored = app.modifierPipeline.modifiers().find((m) => m.id === id);
    expect(stored).toBeInstanceOf(SelectModifier);
    if (stored instanceof SelectModifier) {
      expect(stored.isManual).toBe(true);
      expect(stored.selectionSource).toEqual([7]);
    }
  });

  it("copies the live atom ids into the manual selection beside a session", async () => {
    const app = headless().app;
    const sessionId = app.modifierPipeline.session()?.id;

    app.execute("select_atoms", { ids: [7, 9] });
    await app.writeLiveSelectionToActive();

    const id = app.activeSelectionId;
    expect(id).not.toBe(sessionId);
    expect(id).not.toBeNull();
    const stored = app.modifierPipeline
      .modifiers()
      .find((modifier) => modifier.id === id);
    expect(stored).toBeInstanceOf(SelectModifier);
    if (stored instanceof SelectModifier) {
      expect([...stored.selectionSource]).toEqual([7, 9]);
    }
    expect([...app.world.selectionManager.getSelectedAtomIds()].sort()).toEqual(
      [7, 9],
    );
  });

  it("toggles the session gate without reading modifier capabilities", async () => {
    const app = headless().app;
    const session = app.modifierPipeline.session();
    expect(session).not.toBeNull();
    if (!session) return;

    await app.setEntryEnabled(session, false);

    expect(session.enabled).toBe(false);
  });
});
