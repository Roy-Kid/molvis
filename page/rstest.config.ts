import { pluginReact } from "@rsbuild/plugin-react";
import { defineConfig } from "@rstest/core";

export default defineConfig({
  plugins: [pluginReact()],
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
  },
  include: ["**/?(*.){test,spec}.?(c|m)[jt]s?(x)", "**/test_*.?(c|m)[jt]s?(x)"],
});
