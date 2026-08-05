import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rstest/core";

/** Unit/component lane for React page shell. App E2E → repo-root e2e/. */
export default defineConfig({
  plugins: [pluginReact()],
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
    provider: "playwright",
  },
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
});
