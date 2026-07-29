import { defineConfig } from "@rstest/core";

export default defineConfig({
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
  },
  setupFiles: ["./tests/setup_wasm.ts"],
  tools: {
    rspack(config) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    },
  },
  include: ["**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
});
