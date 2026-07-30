import { defineConfig } from "@rsbuild/core";

/**
 * Dev playground for `@molcrafts/molvis-sketch`.
 * Library build remains rslib (`npm run build`); this is demo-only.
 */
export default defineConfig({
  server: {
    port: 3001,
  },
  html: {
    title: "molvis-sketch dev",
    template: "./examples/index.html",
  },
  source: {
    entry: {
      index: "./examples/demo.ts",
    },
  },
  tools: {
    rspack(config) {
      // molrs is wasm-bindgen bundler-target only.
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    },
  },
});
