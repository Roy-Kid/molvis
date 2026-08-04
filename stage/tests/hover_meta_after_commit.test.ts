import { NullEngine, Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import "./setup_wasm";
import { MolvisApp } from "../src/app";
import { DrawAtomCommand } from "../src/commands/draw";

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  return canvas;
}

describe("hover meta after python-style draw + commit", () => {
  it("resolves atom meta before commit (edit pool only)", async () => {
    const engine = new NullEngine();
    const app = new MolvisApp(makeCanvas(), { gui: false, engine });
    try {
      const result = await app.commandManager.execute(
        new DrawAtomCommand(app, new Vector3(1, 2, 3), { element: "C" }),
      );
      expect(result.atomId).toBe(0);

      const atomState = app.world.sceneIndex.meshRegistry.getAtomState();
      expect(atomState).toBeTruthy();
      const meshId = atomState!.mesh.uniqueId;
      const meta = app.world.sceneIndex.getMeta(meshId, 0);
      expect(meta).not.toBeNull();
      expect(meta?.type).toBe("atom");
      if (meta?.type === "atom") {
        expect(meta.element).toBe("C");
        expect(meta.atomId).toBe(0);
        expect(meta.position.x).toBeCloseTo(1, 5);
      }
    } finally {
      app.destroy();
    }
  });

  it("keeps atom meta after commitScene (Ctrl+S / scene.commit)", async () => {
    const engine = new NullEngine();
    const app = new MolvisApp(makeCanvas(), { gui: false, engine });
    try {
      await app.commandManager.execute(
        new DrawAtomCommand(app, new Vector3(1, 2, 3), { element: "O" }),
      );
      await app.commitScene();

      const atomState = app.world.sceneIndex.meshRegistry.getAtomState();
      expect(atomState).toBeTruthy();
      // After commit rebuild, atoms live in the frame segment.
      expect(atomState!.frameOffset + atomState!.count).toBeGreaterThan(0);

      const meshId = atomState!.mesh.uniqueId;
      const meta = app.world.sceneIndex.getMeta(meshId, 0);
      expect(meta).not.toBeNull();
      expect(meta?.type).toBe("atom");
      if (meta?.type === "atom") {
        expect(meta.element).toBe("O");
      }

      // Meta is frame-backed (edits cleared on commit).
      expect(app.world.sceneIndex.metaRegistry.atoms.edits.size).toBe(0);
      expect(app.world.sceneIndex.metaRegistry.atoms.frame).toBeTruthy();
    } finally {
      app.destroy();
    }
  });
});
