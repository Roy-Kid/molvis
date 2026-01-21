import { Molvis } from "@molvis/core";
import { DrawFrameCommand } from "@molvis/core/commands/draw";

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

    // Create a simple H2O molecule using frameData format
    const drawCmd = new DrawFrameCommand(app, {
        frameData: {
            blocks: {
                atoms: {
                    x: [0.0, 0.757, -0.757],
                    y: [0.0, 0.586, 0.586],
                    z: [0.0, 0.0, 0.0],
                    element: ["O", "H", "H"]
                },
                bonds: {
                    i: [0, 0],
                    j: [1, 2],
                    order: [1, 1]
                }
            }
        }
    });

    await drawCmd.do();

    console.log("✅ Demo frame rendered successfully!");
    console.log("SceneIndex stats:");
    console.log("- Registered meshes:", app.world.scene.meshes.length);

    // Verify data is stored in SceneIndex
    const atomMesh = app.world.scene.meshes.find(m => m.name === "atom_base");
    if (atomMesh) {
        const meta = app.world.sceneIndex.getMeta(atomMesh.uniqueId, 0);
        console.log("- Atom meta:", meta ? "✅ Found" : "❌ Missing");
    }
    app.start();
}

main().catch(console.error);
