import { commands } from "../registry";
import type { MolvisApp } from "../../core/app";
import { AnalysisOp, type RDFOptions } from "../dataOps/analysis";

/**
 * Command: analyze
 * Adds an AnalysisOp to the data pipeline.
 */
commands.register<RDFOptions>("analyze", (app, args) => {
  const op = new AnalysisOp(args);
  app.dataPipeline.appendOp(op);
});

/**
 * Helper function for analysis operations.
 * @param app MolvisApp instance
 * @param args AnalysisOp options
 */
export function analyze(app: MolvisApp, args: RDFOptions) {
  app.execute("analyze", args);
}

