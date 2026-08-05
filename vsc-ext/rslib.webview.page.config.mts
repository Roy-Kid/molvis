/**
 * Separate webview build for the optional Open Page surface.
 * Isolated so React/page never enter the QV / Workbench / Sketch graph.
 */
import path from "node:path";
import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rslib/core";
import { rspack } from "@rspack/core";

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

const spawnWrapper = path.resolve(
  import.meta.dirname,
  "./src/webview/spawnTrajectoryWorker.ts",
);

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      source: {
        entry: {
          "page/index": "./src/page/index.tsx",
        },
        define: sharedDefine,
      },
      output: {
        target: "web",
        distPath: { root: "out" },
        filename: { js: "[name].js", css: "chunks/page-styles.css" },
        chunkFilename: {
          js: "chunks/page-[name].js",
          css: "chunks/page-[name].css",
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
    // Package-name remaps only — resolve via node_modules / exports → dist.
    // Build core/stage/sketch first. Never monorepo ../src paths.
    alias: {
      "@molvis/stage": "@molcrafts/molvis-stage",
      "@molvis/stage/io": "@molcrafts/molvis-stage/io",
      "@molvis/stage/io/formats": "@molcrafts/molvis-stage/io/formats",
      "@": path.resolve(import.meta.dirname, "../page/src"),
    },
  },

  tools: {
    rspack(config) {
      config.node = { ...(config.node || {}), __dirname: "mock" };
      config.module = {
        ...(config.module || {}),
        parser: {
          ...(config.module?.parser || {}),
          javascript: {
            ...(config.module?.parser?.javascript || {}),
            worker: false,
          },
        },
        rules: [
          ...(config.module?.rules || []),
          { resourceQuery: /raw/, type: "asset/source" },
        ],
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
        runtimeChunk: { name: "chunks/page-runtime" },
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            pageShared: {
              name: "chunks/page-shared",
              test: /[\\/](node_modules|core[\\/](src|dist)|stage[\\/](src|dist)|page[\\/]src|sketch[\\/]src)[\\/]/,
              priority: 20,
              enforce: true,
              minSize: 0,
            },
          },
        },
      };
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
      config.plugins = [
        ...(config.plugins ?? []),
        new rspack.NormalModuleReplacementPlugin(
          /transport[\\/]trajectory_worker[\\/]runtime\.ts$/,
          (resource: { context: string; request: string }) => {
            if (resource.context.includes(`${path.sep}vsc-ext${path.sep}`)) {
              return;
            }
            resource.request = spawnWrapper;
          },
        ),
      ];
    },
  },
});
