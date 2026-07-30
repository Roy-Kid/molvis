import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const root = import.meta.dirname;

export default defineConfig({
  server: { port: 3000 },
  plugins: [pluginReact()],
  html: {
    template: "./public/index.html",
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      // 3D engine
      "@molvis/stage": path.resolve(root, "../stage/src/index.ts"),
      "@molvis/stage/io/formats": path.resolve(
        root,
        "../stage/src/io/formats.ts",
      ),
      "@molvis/stage/io": path.resolve(root, "../stage/src/io/index.ts"),
      "@molcrafts/molvis-stage": path.resolve(root, "../stage/src/index.ts"),
      // Shared core (molrs face + elements)
      "@molcrafts/molvis-core": path.resolve(root, "../core/src/index.ts"),
      "@molcrafts/molvis-core/molrs": path.resolve(
        root,
        "../core/src/molrs.ts",
      ),
      "@molcrafts/molvis-core/elements": path.resolve(
        root,
        "../core/src/elements.ts",
      ),
      // 2D sketch
      "@molcrafts/molvis-sketch": path.resolve(root, "../sketch/src/index.ts"),
    },
  },
  source: {
    watchFiles: {
      paths: [
        path.resolve(root, "../core/src/**"),
        path.resolve(root, "../stage/src/**"),
        path.resolve(root, "../sketch/src/**"),
      ],
    },
  },
  performance: {
    chunkSplit: {
      strategy: "custom",
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          babylonjs: {
            test: /[\\/]node_modules[\\/]@babylonjs[\\/](?!serializers)/,
            name: "lib-babylonjs",
            chunks: "initial",
            priority: 20,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: "lib-react",
            chunks: "initial",
            priority: 15,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: "lib-vendors",
            chunks: "initial",
            priority: 10,
            minSize: 20000,
          },
        },
      },
    },
  },
  tools: {
    rspack(config) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
      config.module = {
        ...config.module,
        rules: [
          ...(config.module?.rules ?? []),
          {
            resourceQuery: /raw/,
            type: "asset/source",
          },
        ],
      };
    },
  },
});
