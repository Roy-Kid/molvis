import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { SliceOp, type SliceOptions } from "../dataOps/slice";

/**
 * Command: slice
 * Adds a SliceOp to the data pipeline.
 */
commands.register<SliceOptions>("slice", (app, args) => {
  const op = new SliceOp(args);
  app.dataPipeline.appendOp(op);
});

/**
 * Helper function for slicing frames.
 * @param app MolvisApp instance
 * @param args SliceOp options
 */
export function slice(app: MolvisApp, args: SliceOptions) {
  app.execute("slice", args);
}

