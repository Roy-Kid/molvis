import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import type { Box } from "../../structure";
import { DrawBoxOp, type DrawBoxOpOptions } from "../renderOps/draw_box";

/**
 * Command: draw_box
 * Adds or replaces a DrawBoxOp in the render pipeline.
 * The box is stored in frame.meta for the DrawBoxOp to read.
 */
commands.register<{ box: Box; options?: DrawBoxOpOptions }>("draw_box", async (app, args) => {
  const { box, options = {} } = args;
  
  if (!box) {
    throw new Error("draw_box requires { box }.");
  }

  // Get current frame from data pipeline or use the last computed frame
  let frame = app.dataPipeline.source 
    ? await app.dataPipeline.source.getFrame(app.currentFrame)
    : null;
  
  // If no frame exists, create a minimal one to store the box
  if (!frame) {
    const { Frame, AtomBlock } = await import("../../structure/frame");
    const emptyAtomBlock = new AtomBlock([0], [0], [0], ["H"]);
    frame = new Frame(emptyAtomBlock);
    // Set as source so it can be used later
    const { SingleFrameSource } = await import("../sources");
    app.dataPipeline.source = new SingleFrameSource(frame);
  }
  
  // Store box in frame metadata and also set frame.box if it exists
  frame.meta.set("box", box);
  if (frame.box !== undefined) {
    frame.box = box;
  }

  // Find existing box op if any
  const existingBoxOp = app.renderPipeline.ops.find(
    (op) => op.id.startsWith("DrawBoxOp_")
  );

  const boxOp = new DrawBoxOp(options, existingBoxOp?.id);
  
  if (existingBoxOp) {
    app.renderPipeline.replaceOp(existingBoxOp.id, boxOp);
  } else {
    app.renderPipeline.appendOp(boxOp);
  }

  // Re-render the frame with the box
  const computedFrame = await app.computeFrame(app.currentFrame);
  app.renderFrame(computedFrame);
});

/**
 * Helper function for drawing box.
 * @param app MolvisApp instance
 * @param args Box and options
 */
export async function draw_box(app: MolvisApp, args: { box: Box; options?: DrawBoxOpOptions }) {
  await app.execute("draw_box", args);
}

