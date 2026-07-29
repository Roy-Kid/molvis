import { defineConfig } from "@rslib/core";

/**
 * Library build for `@molcrafts/molvis-sketch`.
 *
 * `@molcrafts/molrs` is wasm-bindgen bundler-target only — external here so
 * hosts share one WASM instance (same pattern as molvis-core).
 */
export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      dts: true,
      source: {
        entry: { index: "./src/**" },
      },
      output: {
        target: "web",
        externals: ["@molcrafts/molrs"],
      },
    },
  ],
});
