import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Docs: https://rsbuild.rs/config/
export default defineConfig(({ command }) => {
  return {
    server: {
      port: 3000,
    },
    plugins: [pluginReact()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@molvis/core": path.resolve(__dirname, "../core/src/index.ts"),
      },
    },
    source: {
      define: {
        // Core expects WASM to be fetched, not inlined as base64 or similar
        __WASM_INLINE__: "false",
      },
    },
  };
});
