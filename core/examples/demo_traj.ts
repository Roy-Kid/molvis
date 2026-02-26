import { Molvis, Trajectory } from "../src/index";

import { Block, Frame } from "@molcrafts/molrs";

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

    const canvas = document.getElementById("molvis-app") as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const app = new Molvis(canvas);

    // Create 3 frames of a simple oscillating H2 molecule
    const frames: Frame[] = [];

    for (let frameIdx = 0; frameIdx < 20; frameIdx++) {
        const atomsBlock = new Block();
        const bondsBlock = new Block();

        // H2 molecule with varying bond length
        // Oscillate between 0.74 and 1.5
        const phase = frameIdx / 20 * Math.PI * 2;
        const distance = 0.74 + (Math.sin(phase) + 1) * 0.3;
        const x = new Float32Array([-distance / 2, distance / 2]);
        const y = new Float32Array([0.0, 0.0]);
        const z = new Float32Array([0.0, 0.0]);
        const elements = ["H", "H"];

        atomsBlock.setColumnF32("x", x);
        atomsBlock.setColumnF32("y", y);
        atomsBlock.setColumnF32("z", z);
        atomsBlock.setColumnStrings("element", elements);

        // Bond
        const bond_i = new Uint32Array([0]);
        const bond_j = new Uint32Array([1]);
        const bond_order = new Uint8Array([1]);

        bondsBlock.setColumnU32("i", bond_i);
        bondsBlock.setColumnU32("j", bond_j);
        bondsBlock.setColumnU8("order", bond_order);

        const frame = new Frame();
        frame.insertBlock("atoms", atomsBlock);
        frame.insertBlock("bonds", bondsBlock);
        frames.push(frame);
    }

    // Create Trajectory
    const trajectory = new Trajectory(frames);
    app.setTrajectory(trajectory);

    console.log("Trajectory loaded with " + frames.length + " frames");

    console.log("Use 'Q' (prev) and 'E' (next) to control playback (handled by ViewMode).");

    app.start();
}

main().catch(console.error);
