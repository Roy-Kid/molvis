import path from "node:path";
import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";

const sharedDefine = {
  __WASM_INLINE__: "false",
  "process.env.NODE_ENV": '"production"',
};

const vendorModulesPattern = /[\\/]node_modules[\\/]/;
const coreSourcePattern = /[\\/]core[\\/]src[\\/]/;

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      source: {
        entry: {
          "webview/index": "./src/webview/index.ts",
          "viewer/index": "./src/viewer/index.tsx",
        },
        define: sharedDefine,
      },
      output: {
        target: "web",
        distPath: { root: "out" },
        filename: { js: "[name].js" },
        chunkFilename: {
          js: "chunks/[name].js",
        },
        sourceMap: { js: false },
        cleanDistPath: false,
        externals: [],
        minify: true,
      },
    },
  ],

  plugins: [pluginReact()],

  source: {
    alias: {
      "@": path.resolve(import.meta.dirname, "../page/src"),
      "@molvis/core": path.resolve(import.meta.dirname, "../core/src/index.ts"),
    },
  },

  tools: {
    rspack(config, { addRules }) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        usedExports: true,
        sideEffects: true,
        providedExports: true,
        innerGraph: true,
        concatenateModules: true,
        runtimeChunk: {
          name: "chunks/runtime",
        },
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              name: "chunks/vendor",
              test: vendorModulesPattern,
              priority: 40,
              enforce: true,
              chunks: "all",
            },
            molvisCore: {
              name: "chunks/molvis-core",
              test: coreSourcePattern,
              priority: 30,
              enforce: true,
              chunks: "all",
            },
          },
        },
      };

      addRules([
        {
          test: /\.wasm$/,
          type: "asset/inline",
        },
      ]);

      config.performance = {
        hints: false,
        maxAssetSize: 15 * 1024 * 1024,
        maxEntrypointSize: 15 * 1024 * 1024,
      };
    },
  },
});
