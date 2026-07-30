import path from "node:path";
import { defineConfig } from "@rslib/core";

/**
 * VS Code webview — isolated trajectory worker
 * ============================================
 *
 * Built **after** the main webview config so `out/` already exists and is
 * not wiped. Emits a single self-contained ESM file:
 *
 *   out/chunks/worker.js
 *
 * plus its wasm asset under `out/static/wasm/`.
 *
 * Must never share splitChunks / runtime with the main webview graph —
 * that dual-ownership is what produced null module exports on main.
 *
 * Loaded by `src/webview/spawnTrajectoryWorker.ts` via
 * `new URL("./worker.js", import.meta.url)` from `chunks/shared.js`.
 */

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      source: {
        entry: {
          "chunks/worker": path.resolve(
            import.meta.dirname,
            "../stage/src/transport/trajectory_worker/worker.ts",
          ),
        },
        define: sharedDefine,
      },
      output: {
        target: "web",
        distPath: { root: "out" },
        filename: { js: "[name].js" },
        sourceMap: { js: false },
        cleanDistPath: false,
        externals: [],
        minify: true,
      },
      tools: {
        rspack(config) {
          config.node = {
            ...(config.node || {}),
            __dirname: "mock",
          };
          config.resolve = {
            ...(config.resolve || {}),
            fallback: {
              ...(config.resolve?.fallback || {}),
              vm: false,
              fs: false,
              path: false,
            },
          };
          config.optimization = {
            ...config.optimization,
            minimize: true,
            splitChunks: false,
            runtimeChunk: false,
          };
          config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
          };
          config.performance = {
            hints: false,
            maxAssetSize: 15 * 1024 * 1024,
            maxEntrypointSize: 15 * 1024 * 1024,
          };
        },
      },
    },
  ],
});
