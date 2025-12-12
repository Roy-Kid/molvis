import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { WrapPBCOp, type WrapPBCOptions } from "../dataOps/wrap_pbc";

/**
 * Command: wrap_pbc
 * Adds a WrapPBCOp to the data pipeline.
 */
commands.register<WrapPBCOptions>("wrap_pbc", (app, args) => {
  const op = new WrapPBCOp(args);
  app.dataPipeline.appendOp(op);
});

/**
 * Helper function for wrapping PBC.
 * @param app MolvisApp instance
 * @param args WrapPBCOp options
 */
export function wrap_pbc(app: MolvisApp, args: WrapPBCOptions = {}) {
  app.execute("wrap_pbc", args);
}

