import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { DrawBondsOp, type DrawBondsOpOptions } from "../renderOps/draw_bonds";

/**
 * Command: draw_bonds
 * Adds a DrawBondsOp to the render pipeline.
 */
commands.register<DrawBondsOpOptions>("draw_bonds", (app, args) => {
  const op = new DrawBondsOp(args);
  app.renderPipeline.appendOp(op);
});

/**
 * Helper function for drawing bonds.
 * @param app MolvisApp instance
 * @param args DrawBondsOp options
 */
export function draw_bonds(app: MolvisApp, args: DrawBondsOpOptions = {}) {
  app.execute("draw_bonds", args);
}

