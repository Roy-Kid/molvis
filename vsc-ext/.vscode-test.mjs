import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out-test/tests/integration/**/*.test.js",
  // Keep the extension-host binary aligned with package.json engines. The
  // unpinned latest build can change its macOS executable layout before the
  // installed test runner learns that layout.
  version: "1.120.0",
  extensionDevelopmentPath: ".",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
