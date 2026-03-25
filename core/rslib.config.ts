import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      dts: true,
      source: {
        define: {
          __WASM_INLINE__: JSON.stringify(false),
        },
      },
      output: {
        target: "web",
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
