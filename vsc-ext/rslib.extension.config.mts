import { createRequire } from "node:module";
import { defineConfig } from "@rslib/core";

const require = createRequire(import.meta.url);

/** Resolve workspace/registry package exports to concrete dist files. */
function pkg(name: string): string {
  return require.resolve(name);
}

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

export default defineConfig({
  lib: [
    {
      format: "cjs",
      bundle: true,
      autoExtension: false,
      source: {
        entry: { extension: "./src/extension/activate.ts" },
        define: sharedDefine,
      },
      output: {
        target: "node",
        distPath: { root: "out" },
        cleanDistPath: false,
        filename: { js: "extension.js" },
        sourceMap: { js: false },
        externals: { vscode: "commonjs vscode" },
        minify: true,
      },
    },
  ],

  resolve: {
    alias: {
      "@molvis/stage": pkg("@molcrafts/molvis-stage"),
      "@molvis/stage/io": pkg("@molcrafts/molvis-stage/io"),
      "@molvis/stage/io/formats": pkg("@molcrafts/molvis-stage/io/formats"),
    },
  },

  tools: {
    rspack(config) {
      config.module = {
        ...config.module,
        parser: {
          ...(config.module?.parser ?? {}),
          javascript: {
            ...(config.module?.parser?.javascript ?? {}),
            exportsPresence: "warn",
          },
        },
      };
    },
  },
});
