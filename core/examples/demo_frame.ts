import { Block, Box, Frame } from "@molcrafts/molrs";
import { DrawBoxCommand, DrawFrameCommand } from "../src/commands/draw";
import { Molvis } from "../src/index";

/**
 * Demo: Single frame rendering
 * Tests the new SceneIndex architecture with a simple H2O molecule
 */

async function main() {
  console.log("Starting demo_frame...");

  // Create canvas
  const canvas = document.getElementById("molvis-app") as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

  const app = new Molvis(canvas);

  // Create a simple H2O molecule using Frame
  const atomsBlock = new Block();
  atomsBlock.setColF("x", new Float64Array([0.0, 0.757, -0.757]));
  atomsBlock.setColF("y", new Float64Array([0.0, 0.586, 0.586]));
  atomsBlock.setColF("z", new Float64Array([0.0, 0.0, 0.0]));
  atomsBlock.setColStr("element", ["O", "H", "H"]);

  const bondsBlock = new Block();
  bondsBlock.setColU32("i", new Uint32Array([0, 0]));
  bondsBlock.setColU32("j", new Uint32Array([1, 2]));
  bondsBlock.setColU32("order", new Uint32Array([1, 1]));

  const box = Box.cube(1, new Float32Array([0, 0, 0]), false, false, false);

  const frame = new Frame();
  frame.insertBlock("atoms", atomsBlock);
  frame.insertBlock("bonds", bondsBlock);

  const drawFrame = new DrawFrameCommand(app, { frame });
  const drawBox = new DrawBoxCommand(app, { box });

  await drawFrame.do();
  await drawBox.do();

  console.log("✅ Demo frame rendered successfully!");
  console.log("SceneIndex stats:");
  console.log("- Registered meshes:", app.world.scene.meshes.length);

  // Verify data is stored in SceneIndex
  const atomMesh = app.world.scene.meshes.find((m) => m.name === "atom_base");
  if (atomMesh) {
    const meta = app.world.sceneIndex.getMeta(atomMesh.uniqueId, 0);
    console.log("- Atom meta:", meta ? "✅ Found" : "❌ Missing");
  }
  app.start();
}

main().catch(console.error);
