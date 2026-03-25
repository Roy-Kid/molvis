import path from "node:path";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  resolve: {
    alias: {
      "@molvis/core": path.resolve(import.meta.dirname, "../core/src/index.ts"),
    },
  },
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExtension: false,
      syntax: "esnext",
      source: {
        entry: { index: "./src/ts/index.ts" },
        define: {
          __WASM_INLINE__: JSON.stringify(true),
        },
      },
      output: {
        target: "web",
        externals: ["@rslib/core"],
        distPath: { root: "src/molvis/dist" },
      },
    },
  ],
  tools: {
    rspack(config, { addRules }) {
      config.experiments = {
        ...(config.experiments || {}),
        outputModule: true,
      };
      config.output = {
        ...(config.output || {}),
        module: true,
        library: { type: "module" },
      };
      addRules([{ test: /\.wasm$/, type: "asset/inline" }]);
    },
  },
});
