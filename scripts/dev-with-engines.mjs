#!/usr/bin/env node
/**
 * Ordered monorepo dev: core → stage+sketch → host.
 *
 * Architecture: hosts resolve engines via package exports → dist/ (never src).
 * Library packages use `rslib build --watch` to keep dist current. Starting
 * every watcher at once races core cleaning/rewriting dist while stage dts
 * resolves `@molcrafts/molvis-core/*` — Module not found floods.
 *
 * This script:
 *   1. starts core watch
 *   2. waits until every core export file exists
 *   3. starts stage + sketch watches
 *   4. waits until stage/sketch main entries exist
 *   5. starts the host (page / page python / engines-only)
 *
 * Usage:
 *   node scripts/dev-with-engines.mjs              # engines only
 *   node scripts/dev-with-engines.mjs page         # + rsbuild dev
 *   node scripts/dev-with-engines.mjs python       # + page → python dist watch
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import waitOn from "wait-on";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mode = process.argv[2] ?? "engines"; // engines | page | python

const corePkg = require(path.join(root, "core/package.json"));

/** @param {Record<string, unknown>} exportsMap */
function exportImportPaths(pkgDir, exportsMap) {
  const files = [];
  for (const [key, value] of Object.entries(exportsMap ?? {})) {
    if (key === "./package.json") continue;
    if (value && typeof value === "object" && "import" in value) {
      const rel = /** @type {{ import: string }} */ (value).import;
      if (typeof rel === "string") {
        files.push(path.join(pkgDir, rel));
      }
    }
  }
  return files;
}

const coreReady = exportImportPaths(path.join(root, "core"), corePkg.exports);
// dts for stage declaration emit (tsc follows types condition)
const coreDtsReady = coreReady
  .filter((f) => f.endsWith(".js"))
  .map((f) => f.replace(/\.js$/, ".d.ts"));

const stageReady = [
  path.join(root, "stage/dist/index.js"),
  path.join(root, "stage/dist/index.d.ts"),
];
const sketchReady = [
  path.join(root, "sketch/dist/index.js"),
  path.join(root, "sketch/dist/index.d.ts"),
];

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function log(msg) {
  console.log(`[dev] ${msg}`);
}

/**
 * @param {string} name
 * @param {string} command
 * @param {string[]} args
 */
function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log(`${name} exited (code=${code}, signal=${signal}) — stopping others`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

/**
 * @param {string[]} resources
 * @param {string} label
 */
async function waitFiles(resources, label) {
  log(`waiting for ${label} (${resources.length} files)…`);
  await waitOn({
    resources: resources.map((f) => `file:${f}`),
    timeout: 180_000,
    interval: 200,
    validateStatus: () => true,
  });
  log(`${label} ready`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
  // Force-exit after grace if children hang
  setTimeout(() => process.exit(code), 2000).unref();
  process.exit(code);
}

process.on("SIGINT", () => {
  log("SIGINT — shutting down");
  shutdown(0);
});
process.on("SIGTERM", () => {
  log("SIGTERM — shutting down");
  shutdown(0);
});

async function main() {
  log(`mode=${mode}  (ordered watch: core → stage+sketch → host)`);

  // Workspace script names live on each package's package.json "dev"
  run("core", "npm", ["run", "dev", "--workspace", "@molcrafts/molvis-core"]);
  await waitFiles([...coreReady, ...coreDtsReady], "core dist");

  run("stage", "npm", ["run", "dev", "--workspace", "@molcrafts/molvis-stage"]);
  run("sketch", "npm", [
    "run",
    "dev",
    "--workspace",
    "@molcrafts/molvis-sketch",
  ]);
  await waitFiles([...stageReady, ...sketchReady], "stage+sketch dist");

  if (mode === "page") {
    run("page", "npm", ["run", "dev", "--workspace", "page"]);
  } else if (mode === "python") {
    run("page", "npm", ["run", "dev:python", "--workspace", "page"]);
  } else if (mode === "engines") {
    log("engines watching (no host)");
  } else {
    console.error(`unknown mode: ${mode} (use engines|page|python)`);
    shutdown(1);
  }

  // Keep process alive while children run
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[dev] failed:", err);
  shutdown(1);
});
