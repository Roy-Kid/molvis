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
      // Package-name imports stay in .d.ts for registry/workspace consumers.
      dts: true,
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
