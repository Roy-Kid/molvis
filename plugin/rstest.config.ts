import { defineConfig } from "@rstest/core";

/** SDK units are pure TS — no browser, no WASM. */
export default defineConfig({
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});
