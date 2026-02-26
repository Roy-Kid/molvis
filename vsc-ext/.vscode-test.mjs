import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out-test/test/integration/**/*.test.js",
  extensionDevelopmentPath: "out-test",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
