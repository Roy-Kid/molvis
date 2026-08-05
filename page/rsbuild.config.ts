import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const root = import.meta.dirname;
const require = createRequire(import.meta.url);
function pkg(name: string): string {
  return require.resolve(name);
}

/**
 * Flatten dist to ``dist/{js,css,wasm}/``.
 *
 * Engines resolve as normal npm packages via workspace install
 * (``node_modules/@molcrafts/*`` → package ``exports`` → dist).
 * Build core/stage/sketch first. Only short-name remaps for ``@molvis/stage*``;
 * never monorepo ``../stage/src`` paths.
 *
 * ``MOLVIS_PYTHON_DEV=1`` writes into the Python package tree.
 */
const pythonDev = process.env.MOLVIS_PYTHON_DEV === "1";
const distRoot = pythonDev
  ? path.join("..", "python", "src", "molvis", "dist")
  : "dist";

export default defineConfig({
  server: { port: 3000 },
  plugins: [pluginReact()],
  html: {
    template: "./public/index.html",
  },
  output: {
    distPath: {
      root: distRoot,
      js: "js",
      jsAsync: "js/async",
      css: "css",
      cssAsync: "css/async",
      wasm: "wasm",
      image: "image",
      font: "font",
      media: "media",
      svg: "svg",
      assets: "assets",
    },
    cleanDistPath: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      // Package exports → dist files (workspace/registry under node_modules).
      "@molvis/stage": pkg("@molcrafts/molvis-stage"),
      "@molvis/stage/io": pkg("@molcrafts/molvis-stage/io"),
      "@molvis/stage/io/formats": pkg("@molcrafts/molvis-stage/io/formats"),
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
      // Stage/sketch ship unbundled ESM (`function f(){} export { f }`). Rspack's
      // strict export presence wrongly flags those local re-exports.
      config.module = {
        ...config.module,
        parser: {
          ...(config.module?.parser ?? {}),
          javascript: {
            ...(config.module?.parser?.javascript ?? {}),
            exportsPresence: "warn",
          },
        },
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
