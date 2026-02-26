import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rslib/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@molvis/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExtension: false,
      syntax: "esnext",
      source: {
        entry: {
          index: "./src/ts/index.ts",
        },
        define: {
          __WASM_INLINE__: JSON.stringify(true),
        },
      },
      output: {
        target: "web",
        externals: ["@rslib/core"],
        distPath: {
          root: "src/molvis/dist",
        },
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
        library: {
          type: "module",
        },
      };
      addRules([
        {
          test: /\.wasm$/,
          type: "asset/inline",
        },
      ]);
    },
  },
});
