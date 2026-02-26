import * as path from "path";
import { pluginReact } from "@rsbuild/plugin-react";
// rslib.config.ts
import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    // Extension host (Node.js)
    {
      format: "cjs",
      bundle: true,
      autoExtension: false,
      source: {
        entry: {
          extension: "./src/extension/activate.ts",
        },
        define: {
          __WASM_INLINE__: "false",
          "process.env.NODE_ENV": '"production"',
        },
      },
      output: {
        target: "node",
        distPath: {
          root: "out",
        },
        filename: {
          js: "extension.js",
        },
        sourceMap: {
          js: false,
        },
        externals: {
          vscode: "commonjs vscode",
        },
        minify: true,
      },
    },
    // Webview (Browser)
    {
      format: "esm",
      bundle: true,
      autoExtension: false,
      source: {
        entry: {
          "webview/index": "./src/webview-app/index.ts",
        },
        define: {
          __WASM_INLINE__: "false",
          "process.env.NODE_ENV": '"production"',
        },
      },
      output: {
        target: "web",
        distPath: {
          root: "out",
        },
        filename: {
          js: "[name].js",
        },
        sourceMap: {
          js: false,
        },
        externals: {},
        minify: true,
      },
    },
    // Viewer (Browser - React App)
    {
      format: "esm",
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      source: {
        entry: {
          "viewer/index": "./src/viewer-app/index.tsx",
        },
        define: {
          __WASM_INLINE__: "false",
          "process.env.NODE_ENV": '"production"',
        },
      },
      output: {
        target: "web",
        distPath: {
          root: "out",
        },
        filename: {
          js: "[name].js",
        },
        sourceMap: {
          js: false,
        },
        externals: [],
        minify: true,
      },
    },
  ],

  plugins: [pluginReact()],

  source: {
    alias: {
      "@": path.resolve(__dirname, "../page/src"),
      "@molvis/core": path.resolve(__dirname, "../core/src/index.ts"),
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
      };

      const filename = config.output?.filename?.toString() || "";
      if (filename.includes("webview") || filename.includes("viewer")) {
        config.externalsPresets = {};
        config.externals = [];
      }

      addRules([
        {
          test: /\.wasm$/,
          type: "asset/inline",
        },
      ]);

      config.performance = {
        hints: false,
        maxAssetSize: 10 * 1024 * 1024,
        maxEntrypointSize: 10 * 1024 * 1024,
      };
    },
  },
});
