import { defineConfig } from "@rstest/core";

/**
 * Unit lane only. Browser mode (@rstest/browser + Playwright Chromium) for
 * WASM/DOM. Full app E2E lives in repo-root `e2e/` with @rstest/playwright.
 */
export default defineConfig({
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
    // Explicit Playwright provider (default); peer `playwright` must be installed.
    provider: "playwright",
  },
  // Import bundler-target @molcrafts/molvis-core/molrs before every test file so its WASM
  // side-effect (import .wasm + __wbindgen_start) runs before collection.
  // rstest awaits setupFiles; a bare import inside a test file does not get
  // top-level await honored by the collection shim.
  // Never add a wasm-bindgen web-target init() path — molrs is bundler-only.
  setupFiles: ["./tests/setup_wasm.ts"],
  tools: {
    rspack(config) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    },
  },
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/integration/**",
    "**/e2e/**",
  ],
});
