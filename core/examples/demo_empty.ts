import { Block, Frame, Molvis, Trajectory } from "../src/index";

/**
 * Demo: Empty frame bootstrap
 *
 * Purpose:
 * - Start from an explicit empty frame.
 * - Verify renderer warmup + start guard behavior.
 * - Switch to Edit mode immediately to validate atom/bond drawing workflow.
 */
async function main() {
    console.log("Starting demo_empty...");

    const canvas = document.getElementById("molvis-app") as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const app = new Molvis(canvas);

    // Build an explicit empty frame: blocks exist but contain zero rows.
    // This is the scenario that previously exposed edit snapping issues.
    const emptyAtoms = new Block();
    emptyAtoms.setColumnF32("x", new Float32Array(0));
    emptyAtoms.setColumnF32("y", new Float32Array(0));
    emptyAtoms.setColumnF32("z", new Float32Array(0));
    emptyAtoms.setColumnStrings("element", []);

    const emptyBonds = new Block();
    emptyBonds.setColumnU32("i", new Uint32Array(0));
    emptyBonds.setColumnU32("j", new Uint32Array(0));
    emptyBonds.setColumnU8("order", new Uint8Array(0));

    const emptyFrame = new Frame();
    emptyFrame.insertBlock("atoms", emptyAtoms);
    emptyFrame.insertBlock("bonds", emptyBonds);

    app.setTrajectory(new Trajectory([emptyFrame]));
    app.world.grid.enable();

    await app.start();
    app.setMode("edit");

    console.log("✅ demo_empty ready");
    console.log("Try left-click to create atoms, drag from an atom to create bonds.");
}

main().catch((error) => {
    console.error("demo_empty failed:", error);
});

