import path from "node:path";
import { defineConfig } from "@rslib/core";

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

export default defineConfig({
  lib: [
    {
      format: "cjs",
      bundle: true,
      autoExtension: false,
      source: {
        entry: { extension: "./src/extension/activate.ts" },
        define: sharedDefine,
      },
      output: {
        target: "node",
        distPath: { root: "out" },
        cleanDistPath: false,
        filename: { js: "extension.js" },
        sourceMap: { js: false },
        externals: { vscode: "commonjs vscode" },
        minify: true,
      },
    },
  ],

  resolve: {
    alias: {
      "@molvis/stage": "@molcrafts/molvis-stage",
      "@molvis/stage/io": "@molcrafts/molvis-stage/io",
      "@molvis/stage/io/formats": "@molcrafts/molvis-stage/io/formats",
    },
  },
});
