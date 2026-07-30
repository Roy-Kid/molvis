import { defineConfig } from "@rslib/core";

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
        externals: [
          "@molcrafts/molvis-sketch",
          "@molcrafts/molvis-stage",
          "@molcrafts/molvis-core",
        ],
      },
    },
  ],
});
