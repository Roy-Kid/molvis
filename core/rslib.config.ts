import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      dts: {
        distPath: "./dist",
      },
      source: {
        entry: {
          index: "./src/index.ts",
        },
        define: {
          __WASM_INLINE__: JSON.stringify(false),
        },
      },
      output: {
        target: "web",
        distPath: {
          root: "dist",
        },
        externals: [
          "@babylonjs/core",
          "@babylonjs/gui",
          "@babylonjs/inspector",
          "@babylonjs/materials",
          "@molcrafts/molrs",
          "tslog",
        ],
      },
    },
  ],
});
