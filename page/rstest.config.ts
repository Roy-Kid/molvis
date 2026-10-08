import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rstest/core";

/** Unit tests: plain Node, no browser APIs. */
export default defineConfig({
  plugins: [pluginReact()],
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});
