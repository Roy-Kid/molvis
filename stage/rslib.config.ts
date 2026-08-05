import { defineConfig } from "@rslib/core";
import { rspack } from "@rspack/core";

/**
 * Library build for `@molcrafts/molvis-stage` (3D engine).
 *
 * molrs is reached only via `@molcrafts/molvis-core` (workspace private).
 * Never import `@molcrafts/molrs` here.
 *
 * The bundled `viewer` CDN entry must enable `asyncWebAssembly` so rspack
 * wires the `.wasm` module.
 */
const RUNTIME_EXTERNALS = [
  "@babylonjs/core",
  "@babylonjs/gui",
  "@babylonjs/materials",
  "@molcrafts/molvis-core",
  "@molcrafts/molvis-core/molrs",
  "@molcrafts/molvis-core/elements",
  "@molcrafts/molvis-core/element-picker",
  "@molcrafts/molvis-core/opfs",
  "@molcrafts/molvis-core/platform",
  "@molcrafts/molvis-core/save-file",
  "@molcrafts/molvis-core/image-crop",
  "tslog",
] as const;

/** Debug-only Babylon packages that must never land in stage dist. */
const BABYLON_BANNED = [
  "@babylonjs/inspector",
  "@babylonjs/gui-editor",
  "@babylonjs/loaders",
] as const;

/** Watch must not wipe dist — page/hosts resolve exports→dist concurrently. */
const watching = process.argv.includes("--watch");

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      // Keep package-name imports in .d.ts (consumers resolve @molcrafts/molvis-core
      // from the registry/workspace). Never rewrite to monorepo-relative paths.
      dts: true,
      source: {
        entry: { index: "./src/**" },
        tsconfigPath: "./tsconfig.build.json",
      },
      output: {
        target: "web",
        cleanDistPath: !watching,
        externals: [...RUNTIME_EXTERNALS, ...BABYLON_BANNED],
      },
    },
    {
      format: "esm",
      bundle: true,
      autoExternal: false,
      dts: false,
      source: {
        entry: { viewer: "./src/element_entry.ts" },
        tsconfigPath: "./tsconfig.build.json",
      },
      output: {
        target: "web",
        cleanDistPath: !watching,
      },

      tools: {
        rspack(config) {
          config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
          };
          config.output = {
            ...config.output,
            publicPath: "auto",
          };
          const ban = BABYLON_BANNED.map((name) =>
            name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ).join("|");
          config.plugins = [
            ...(config.plugins ?? []),
            new rspack.IgnorePlugin({
              resourceRegExp: new RegExp(ban),
            }),
          ];
        },
      },
    },
  ],
});
