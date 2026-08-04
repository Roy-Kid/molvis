import { defineConfig } from "@rslib/core";

/**
 * Library build for `@molcrafts/molvis-sketch`.
 * molrs only via `@molcrafts/molvis-core` so hosts share one WASM instance.
 */
export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      dts: {
        alias: {
          "@molcrafts/molvis-core": "../core/dist/index.d.ts",
          "@molcrafts/molvis-core/molrs": "../core/dist/molrs.d.ts",
          "@molcrafts/molvis-core/elements": "../core/dist/elements.d.ts",
          "@molcrafts/molvis-core/platform": "../core/dist/platform.d.ts",
          "@molcrafts/molvis-core/save-file": "../core/dist/save_file.d.ts",
          "@molcrafts/molvis-core/element-picker":
            "../core/dist/element_picker.d.ts",
        },
      },
      source: {
        entry: { index: "./src/**" },
        tsconfigPath: "./tsconfig.build.json",
      },
      output: {
        target: "web",
        externals: [
          "@molcrafts/molvis-core",
          "@molcrafts/molvis-core/molrs",
          "@molcrafts/molvis-core/elements",
          "@molcrafts/molvis-core/element-picker",
          "@molcrafts/molvis-core/platform",
          "@molcrafts/molvis-core/save-file",
        ],
      },
    },
  ],
});
