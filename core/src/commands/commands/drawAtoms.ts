import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { DrawAtomsOp, type DrawAtomsOpOptions } from "../renderOps/draw_atoms";

/**
 * Command: draw_atoms
 * Adds a DrawAtomsOp to the render pipeline.
 */
commands.register<DrawAtomsOpOptions>("draw_atoms", (app, args) => {
  const op = new DrawAtomsOp(args);
  app.renderPipeline.appendOp(op);
});

/**
 * Helper function for drawing atoms.
 * @param app MolvisApp instance
 * @param args DrawAtomsOp options
 */
export function draw_atoms(app: MolvisApp, args: DrawAtomsOpOptions = {}) {
  app.execute("draw_atoms", args);
}

