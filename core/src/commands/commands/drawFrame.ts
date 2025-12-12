import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import type { Frame } from "../../structure/frame";
import type { DrawFrameOption } from "../types";
import { DrawAtomsOp } from "../renderOps/draw_atoms";
import { DrawBondsOp } from "../renderOps/draw_bonds";
import { DrawBoxOp } from "../renderOps/draw_box";
import { SingleFrameSource } from "../sources";

/**
 * Command: draw_frame
 * Draws a complete frame (atoms, bonds, and optionally box) using the render pipeline.
 */
commands.register<{ frame: Frame; options?: DrawFrameOption }>("draw_frame", async (app, args) => {
  const { frame, options } = args;
  
  if (!frame) {
    throw new Error("draw_frame requires { frame }.");
  }

  const drawOptions = options ?? {};

  // Clear existing render ops for this frame
  app.renderPipeline.clear();

  // Always draw atoms by default
  const atomsOp = new DrawAtomsOp({
    radii: drawOptions.atoms?.radii,
    color: drawOptions.atoms?.color,
  });
  app.renderPipeline.appendOp(atomsOp);

  // Draw bonds if bondBlock exists (or if explicitly requested)
  if (frame.bondBlock && frame.bondBlock.n_bonds > 0) {
    const bondsOp = new DrawBondsOp({
      radius: drawOptions.bonds?.radii,
    });
    app.renderPipeline.appendOp(bondsOp);
  }

  // Draw box if provided in options
  if (drawOptions.box !== undefined) {
    const boxOp = new DrawBoxOp({
      visible: drawOptions.box.visible ?? true,
      color: drawOptions.box.color,
      lineWidth: drawOptions.box.lineWidth,
    });
    app.renderPipeline.appendOp(boxOp);
  }

  // Set frame source and render
  app.dataPipeline.source = new SingleFrameSource(frame);
  const computedFrame = await app.computeFrame(0);
  
  // Ensure frame has the box if it was set
  if (frame.box) {
    computedFrame.meta.set("box", frame.box);
  }
  
  app.renderFrame(computedFrame);
});

/**
 * Helper function for drawing a frame.
 * @param app MolvisApp instance
 * @param args Frame and options
 */
export async function draw_frame(
  app: MolvisApp,
  args: { frame: Frame; options?: DrawFrameOption }
) {
  await app.execute("draw_frame", args);
}

