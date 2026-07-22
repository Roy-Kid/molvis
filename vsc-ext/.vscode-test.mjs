import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out-test/tests/integration/**/*.test.js",
  extensionDevelopmentPath: ".",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
