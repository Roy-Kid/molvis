import { Molvis } from "@molvis/core";
import { DrawFrameCommand } from "@molvis/core/commands/draw";
import { Block } from "molrs-wasm";

/**
 * Demo: Trajectory rendering
 * 
 * This demo creates multiple frames to test:
 * - Frame switching
 * - EntityRegistry frame data storage
 * - Mesh reuse across frames
 */

async function main() {
    console.log("Starting demo_traj...");

    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const app = new Molvis(canvas);

    // Create 3 frames of a simple oscillating H2 molecule
    const frames = [];

    for (let frameIdx = 0; frameIdx < 3; frameIdx++) {
        const atomsBlock = new Block();
        const bondsBlock = new Block();

        // H2 molecule with varying bond length
        const distance = 0.74 + frameIdx * 0.1; // 0.74, 0.84, 0.94 Å
        const x = new Float32Array([-distance / 2, distance / 2]);
        const y = new Float32Array([0.0, 0.0]);
        const z = new Float32Array([0.0, 0.0]);
        const elements = ["H", "H"];

        atomsBlock.set_col_f32("x", x, undefined);
        atomsBlock.set_col_f32("y", y, undefined);
        atomsBlock.set_col_f32("z", z, undefined);
        atomsBlock.set_col_strings("element", elements, undefined);

        // Bond
        const bond_i = new Uint32Array([0]);
        const bond_j = new Uint32Array([1]);
        const bond_order = new Uint8Array([1]);

        bondsBlock.set_col_u32("i", bond_i, undefined);
        bondsBlock.set_col_u32("j", bond_j, undefined);
        bondsBlock.set_col_u8("order", bond_order, undefined);

        frames.push({ atomsBlock, bondsBlock });
    }

    // Render first frame
    console.log("Rendering frame 0...");
    let drawCmd = new DrawFrameCommand(app, {
        atomsBlock: frames[0].atomsBlock,
        bondsBlock: frames[0].bondsBlock
    });
    await drawCmd.do();

    // Switch to frame 1 after 2 seconds
    setTimeout(async () => {
        console.log("Switching to frame 1...");
        drawCmd = new DrawFrameCommand(app, {
            atomsBlock: frames[1].atomsBlock,
            bondsBlock: frames[1].bondsBlock
        });
        await drawCmd.do();
    }, 2000);

    // Switch to frame 2 after 4 seconds
    setTimeout(async () => {
        console.log("Switching to frame 2...");
        drawCmd = new DrawFrameCommand(app, {
            atomsBlock: frames[2].atomsBlock,
            bondsBlock: frames[2].bondsBlock
        });
        await drawCmd.do();
        console.log("✅ Trajectory demo complete!");
    }, 4000);
}

main().catch(console.error);
