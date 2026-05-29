// Ambient declarations for non-code side-effect imports.
//
// TypeScript 6 (with `moduleResolution: "bundler"`) errors on side-effect
// imports of files it has no type information for (TS2882). Stylesheets are
// handled entirely by the bundler (rsbuild), so we declare them as opaque
// modules. This file is also pulled into the vsc-ext program (its tsconfig
// includes `../page/src/**/*.d.ts`), covering the webview's CSS imports too.
declare module "*.css";
