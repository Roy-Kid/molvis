import path from "node:path";
import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";

const sharedDefine = {
  __WASM_INLINE__: "false",
  "process.env.NODE_ENV": '"production"',
};

const vendorModulesPattern = /[\\/]node_modules[\\/]/;
const coreSourcePattern = /[\\/]core[\\/](src|dist)[\\/]/;

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

  resolve: {
    alias: {
      "@molvis/core": path.resolve(import.meta.dirname, "../core/src/index.ts"),
      "@molvis/core/io/formats": path.resolve(
        import.meta.dirname,
        "../core/src/io/formats.ts",
      ),
      "@molvis/core/io": path.resolve(
        import.meta.dirname,
        "../core/src/io/index.ts",
      ),
      "@": path.resolve(import.meta.dirname, "../page/src"),
    },
  },

  tools: {
    rspack(config, { addRules }) {
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
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /Critical dependency/,
        /__dirname/,
        /Can't resolve 'vm'/,
        /Can't resolve 'fs'/,
      ];
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
            molrs: {
              name: "chunks/molrs",
              test: /[\\/]node_modules[\\/]@molcrafts[\\/]molrs[\\/]/,
              priority: 35,
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
});
