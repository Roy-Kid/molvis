import { defineConfig } from "@rslib/core";

const sharedDefine = {
  "process.env.NODE_ENV": '"production"',
};

/**
 * VS Code extension host (Node). `autoExternal` is off: the VSIX is
 * packaged `--no-dependencies`, so every import except `vscode` must
 * land in `out/extension.js`.
 */
export default defineConfig({
  lib: [
    {
      format: "cjs",
      bundle: true,
      autoExternal: false,
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
