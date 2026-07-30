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
  "tslog",
] as const;

/** Debug-only Babylon packages that must never land in stage dist. */
const BABYLON_BANNED = [
  "@babylonjs/inspector",
  "@babylonjs/gui-editor",
  "@babylonjs/loaders",
] as const;

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      dts: {
        alias: {
          "@molcrafts/molvis-core": "../core/dist/index.d.ts",
          "@molcrafts/molvis-core/molrs": "../core/dist/molrs.d.ts",
          "@molcrafts/molvis-core/elements": "../core/dist/elements.d.ts",
          "@molcrafts/molvis-core/element-picker":
            "../core/dist/element_picker.d.ts",
        },
      },
      source: {
        entry: { index: "./src/**" },
        tsconfigPath: "./tsconfig.build.json",
      },
      output: {
        target: "web",
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
