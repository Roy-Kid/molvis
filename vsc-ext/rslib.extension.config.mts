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
      "@molvis/stage/io/formats": path.resolve(
        import.meta.dirname,
        "../stage/src/io/formats.ts",
      ),
      "@molcrafts/molvis-core/molrs": path.resolve(
        import.meta.dirname,
        "../core/src/molrs.ts",
      ),
    },
  },
});
