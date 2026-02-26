import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  server: { port: 3000 },
  plugins: [pluginReact()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@molvis/core": path.resolve(import.meta.dirname, "../core/src/index.ts"),
    },
  },
  source: {
    define: {
      __WASM_INLINE__: "false",
    },
  },
});
