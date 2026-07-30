import { defineConfig } from "@rslib/core";

/**
 * Unbundled library build for `@molcrafts/molvis-core`.
 * molrs is external so hosts share one WASM graph.
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
