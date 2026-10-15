import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rstest/core";
import { molcraftsUiAlias } from "./molcrafts-ui-alias";

/** Unit/component lane for the React page shell. There is no e2e lane. */
export default defineConfig({
  plugins: [pluginReact()],
  resolve: {
    alias: molcraftsUiAlias(import.meta.dirname),
  },
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
    provider: "playwright",
  },
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});
