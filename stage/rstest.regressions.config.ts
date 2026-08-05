import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rstest/core";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Repo-root regressions under Chromium + WASM (not part of default unit suite).
export default defineConfig({
  root: monorepoRoot,
  browser: {
    enabled: true,
    name: "chromium",
    headless: true,
    provider: "playwright",
  },
  setupFiles: [path.join(monorepoRoot, "core/tests/setup_wasm.ts")],
  tools: {
    rspack(config) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    },
  },
  include: ["regressions/**/*.test.ts"],
});
