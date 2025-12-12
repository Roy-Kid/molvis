import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { SelectByPropertyOp, type SelectByPropertyOptions } from "../dataOps/select";

/**
 * Command: select
 * Adds a SelectByPropertyOp to the data pipeline.
 */
commands.register<SelectByPropertyOptions>("select", (app, args) => {
  const op = new SelectByPropertyOp(args);
  app.dataPipeline.appendOp(op);
});

/**
 * Helper function for selecting atoms by property.
 * @param app MolvisApp instance
 * @param args SelectByPropertyOp options
 */
export function select(app: MolvisApp, args: SelectByPropertyOptions) {
  app.execute("select", args);
}

