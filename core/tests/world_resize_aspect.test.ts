import { NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "@rstest/core";
import { MolvisRenderer } from "../src/renderer";
import "./setup_wasm";

function mkRenderer(w: number, h: number): MolvisRenderer {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  document.body.appendChild(canvas);
  return new MolvisRenderer(canvas, { engine: new NullEngine() });
}

describe("World.resize — ortho aspect", () => {
  it("re-syncs ortho frustum when viewport aspect changes", () => {
    const r = mkRenderer(200, 100);
    const canvas = r.app.canvas;
    try {
      const cam = r.app.world.camera;
      cam.mode = 1; // ortho
      // Square frustum on a wide viewport would stretch without aspect sync.
      cam.orthoTop = 5;
      cam.orthoBottom = -5;
      cam.orthoLeft = -5;
      cam.orthoRight = 5;

      r.app.world.syncOrthographicAspect();

      const halfH = (cam.orthoTop! - cam.orthoBottom!) / 2;
      const halfW = (cam.orthoRight! - cam.orthoLeft!) / 2;
      expect(halfH).toBeCloseTo(5, 5);
      const engine = r.app.world.scene.getEngine();
      const aspect = engine.getAspectRatio(cam);
      expect(halfW).toBeCloseTo(halfH * aspect, 5);
    } finally {
      r.dispose();
      canvas.remove();
    }
  });
});
