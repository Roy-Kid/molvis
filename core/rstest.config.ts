import { defineConfig } from "@rstest/core";

export default defineConfig({
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
  },
});
