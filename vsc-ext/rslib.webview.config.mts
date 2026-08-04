import path from "node:path";
import { defineConfig } from "@rslib/core";
import { rspack } from "@rspack/core";

/**
 * VS Code webview — main-thread bundle
 * =====================================
 *
 * Entries:
 *   - `webview/index`    — Quick View / custom-editor preview (stage only)
 *   - `workbench/index`  — Workbench thin shell (dynamic stage + capabilities)
 *   - `sketch/index`     — standalone 2D structure editor
 *
 * The trajectory worker is a **separate** build
 * (`rslib.webview.worker.config.mts`) so it never shares a module graph
 * with this file. See that file + package.json `build:webview` for the
 * two-step pipeline.
 *
 * ## Hard rules
 *
 * 1. **One webpack runtime** (`chunks/runtime.js`) for every main-thread
 *    chunk. Dual runtimes previously caused
 *    `chunkId === owner ? value : null` exports and
 *    `f[e] is not a function` / `Object.values(undefined)` /
 *    `X is not iterable` failures at module init.
 *
 * 2. **One sync shared chunk** (`chunks/shared`) for engines + core +
 *    node_modules used by webview entries. **Never** pull `page/src`
 *    (page depends on sketch/stage; hosts must not reverse that).
 *
 * 3. **Async-only heavies** — plotly / babylon-serializers.
 *
 * 4. **No worker extraction** (`worker: false`). Main loads
 *    `chunks/worker.js` via a runtime-relative URL (see
 *    `src/webview/spawnTrajectoryWorker.ts`).
 *
 * ## Output (after both builds)
 *
 * ```
 * out/
 *   webview/index.js  workbench/index.js  sketch/index.js
 *   chunks/runtime.js chunks/shared.js chunks/styles.css
 *   chunks/worker.js                  ← from worker config
 *   chunks/babylon-serializers.js
 *   static/wasm/*.module.wasm
 * ```
 *
 * Quick View / Workbench must not statically import `page/src` (React product).
 */

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

const sharedModulesPattern =
  /[\\/](node_modules|core[\\/](src|dist)|stage[\\/](src|dist)|sketch[\\/]src)[\\/]/;

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
          "webview/index": "./src/webview/index.ts",
          "workbench/index": "./src/workbench/index.ts",
          "sketch/index": "./src/sketch/index.ts",
        },
        define: sharedDefine,
      },
      output: {
        target: "web",
        distPath: { root: "out" },
        filename: { js: "[name].js", css: "[name].css" },
        chunkFilename: {
          js: "chunks/[name].js",
          css: "chunks/[name].css",
        },
        sourceMap: { js: false },
        cleanDistPath: false,
        externals: [],
        minify: true,
      },
    },
  ],

  // No React in webview entries (QV/Workbench = stage; Sketch = sketch package).
  plugins: [],

  resolve: {
    alias: {
      "@molvis/stage": path.resolve(
        import.meta.dirname,
        "../stage/src/index.ts",
      ),
      "@molvis/stage/io/formats": path.resolve(
        import.meta.dirname,
        "../stage/src/io/formats.ts",
      ),
      "@molvis/stage/io": path.resolve(
        import.meta.dirname,
        "../stage/src/io/index.ts",
      ),
      "@molcrafts/molvis-stage": path.resolve(
        import.meta.dirname,
        "../stage/src/index.ts",
      ),
      "@molcrafts/molvis-core": path.resolve(
        import.meta.dirname,
        "../core/src/index.ts",
      ),
      "@molcrafts/molvis-core/molrs": path.resolve(
        import.meta.dirname,
        "../core/src/molrs.ts",
      ),
      "@molcrafts/molvis-core/elements": path.resolve(
        import.meta.dirname,
        "../core/src/elements.ts",
      ),
      "@molcrafts/molvis-core/element-picker": path.resolve(
        import.meta.dirname,
        "../core/src/element_picker.ts",
      ),
      "@molcrafts/molvis-core/save-file": path.resolve(
        import.meta.dirname,
        "../core/src/save_file.ts",
      ),
      "@molcrafts/molvis-core/platform": path.resolve(
        import.meta.dirname,
        "../core/src/platform.ts",
      ),
      "@molcrafts/molvis-core/opfs": path.resolve(
        import.meta.dirname,
        "../core/src/opfs.ts",
      ),
      "@molcrafts/molvis-core/image-crop": path.resolve(
        import.meta.dirname,
        "../core/src/image_crop.ts",
      ),
      "@molcrafts/molvis-sketch": path.resolve(
        import.meta.dirname,
        "../sketch/src/index.ts",
      ),
    },
  },

  tools: {
    rspack(config) {
      config.node = {
        ...(config.node || {}),
        __dirname: "mock",
      };
      config.module = {
        ...(config.module || {}),
        parser: {
          ...(config.module?.parser || {}),
          javascript: {
            ...(config.module?.parser?.javascript || {}),
            // Worker is a separate rslib config — keep it out of this graph.
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
            plotly: {
              name: "chunks/plotly",
              test: /[\\/]node_modules[\\/]plotly\.js-dist-min[\\/]/,
              priority: 50,
              enforce: true,
              chunks: "async",
            },
            babylonSerializers: {
              name: "chunks/babylon-serializers",
              test: /[\\/]node_modules[\\/]@babylonjs[\\/]serializers[\\/]/,
              priority: 55,
              enforce: true,
              chunks: "async",
            },
            styles: {
              name: "chunks/styles",
              type: "css/mini-extract",
              priority: 100,
              enforce: true,
              chunks: "initial",
            },
            shared: {
              name: "chunks/shared",
              test: sharedModulesPattern,
              priority: 20,
              enforce: true,
              chunks: "all",
              minSize: 0,
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

      // Main-graph imports of core's trajectory runtime → VS Code spawn
      // wrapper (loads isolated chunks/worker.js). The wrapper imports the
      // real runtime from a vsc-ext context path and is not rewritten.
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
