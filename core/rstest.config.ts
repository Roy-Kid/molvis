import { fileURLToPath } from "node:url";
import { defineConfig } from "@rstest/core";
import { MolrsBuild } from "./molrs.build";

new MolrsBuild(fileURLToPath(new URL("..", import.meta.url))).ensure();

/** Unit tests: plain Node, no browser APIs. */
export default defineConfig({
  include: ["tests/**/?(*.){test,spec}.?(c|m)[jt]s?(x)"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});
