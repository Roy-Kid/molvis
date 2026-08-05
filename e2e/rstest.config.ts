import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rstest/core";

const e2eRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E lane: Node workers + @rstest/playwright fixtures (page, context, serve).
 * Scoped strictly to this directory — never picks up package unit tests.
 */
export default defineConfig({
  root: e2eRoot,
  testEnvironment: "node",
  isolate: false,
  include: ["./**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**"],
  passWithNoTests: true,
});
