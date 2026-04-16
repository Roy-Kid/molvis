import { defineConfig } from "@rstest/core";

export default defineConfig({
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
  },
  include: ["**/?(*.){test,spec}.?(c|m)[jt]s?(x)", "**/test_*.?(c|m)[jt]s?(x)"],
});
