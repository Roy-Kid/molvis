import { defineConfig } from "@rslib/core";

/**
 * Unbundled library build for `@molcrafts/molvis-core`.
 * molrs is external so hosts share one WASM graph.
 *
 * Watch must not wipe `dist/` — dependents resolve package exports to dist,
 * and a clean mid-rebuild races stage/sketch/page (Module not found).
 */
const watching = process.argv.includes("--watch");

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
        cleanDistPath: !watching,
        externals: ["@molcrafts/molrs"],
      },
    },
  ],
});
