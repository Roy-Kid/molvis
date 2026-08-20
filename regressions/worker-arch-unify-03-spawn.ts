/**
 * Seam lock for spec worker-arch-unify-03-spawn: the single
 * `@molcrafts/molvis-stage/worker-spawner` subpath, the declared breaking
 * removal of `spawnTrajectoryWorker` from `./trajectory-runtime`, and the
 * death of the vsc-ext worker-rewrites plugin in favor of one exact-match
 * resolve.alias line.
 *
 * Goldens are the spec's own literals (ac-010, defined 2026-08-20 — no
 * third-party oracle): the worker-spawner export list
 * ["DeferredWorker", "spawnComputeWorker", "spawnTrajectoryWorker"], both
 * spawns async functions, and the webview config markers "worker-spawner$"
 * present / "worker-rewrites" absent.
 *
 * Run with the repo TS runner: `node regressions/worker-arch-unify-03-spawn.ts`
 * after `npm run build:stage`.
 *
 * The `.wasm` stub exists only so the published subpaths are *evaluable*
 * under node: worker_spawner pulls the trajectory runtime, whose frame
 * codec imports the bundler-target molrs glue, and node has no ESM loader
 * for its `.wasm`. Nothing below calls molrs and no WASM module is
 * instantiated — importing the seam constructs no Worker either (spawns
 * are only ever called, never run at module top level), so no DOM or
 * Worker shim is needed.
 */
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

registerHooks({
  load(url, context, next) {
    if (!url.endsWith(".wasm")) return next(url, context);
    return {
      format: "module",
      shortCircuit: true,
      source: "export function __wbindgen_start() {}\n",
    };
  },
});

// Golden 1: the worker-spawner subpath exports exactly the three seam
// symbols, and both spawn functions carry the async seam signature.
const spawner: Record<string, unknown> = await import(
  "@molcrafts/molvis-stage/worker-spawner"
);

const expectedExports = [
  "DeferredWorker",
  "spawnComputeWorker",
  "spawnTrajectoryWorker",
];
const actualExports = Object.keys(spawner).sort();
assert(
  actualExports.join(",") === expectedExports.join(","),
  `worker-spawner exports [${actualExports.join(", ")}], ` +
    `expected exactly [${expectedExports.join(", ")}]`,
);

for (const name of ["spawnTrajectoryWorker", "spawnComputeWorker"]) {
  const fn = spawner[name];
  assert(typeof fn === "function", `${name} is not a function`);
  assert(
    (fn as { constructor: { name: string } }).constructor.name ===
      "AsyncFunction",
    `${name} must be an async function (seam contract)`,
  );
}

// Golden 2: the declared breaking removal holds — ./trajectory-runtime no
// longer exports spawnTrajectoryWorker (its move to ./worker-spawner must
// not regress), while TrajectoryRuntime itself stays put.
const runtime: Record<string, unknown> = await import(
  "@molcrafts/molvis-stage/trajectory-runtime"
);
assert(
  typeof runtime.TrajectoryRuntime === "function",
  "TrajectoryRuntime left ./trajectory-runtime",
);
assert(
  !("spawnTrajectoryWorker" in runtime),
  "./trajectory-runtime must not re-grow spawnTrajectoryWorker",
);

// Golden 3: the vsc-ext seam wiring — both webview configs carry the
// exact-match alias key and no worker-rewrites reference, and the retired
// rewrites module stays deleted.
const here = dirname(fileURLToPath(import.meta.url));
for (const name of [
  "rslib.webview.config.mts",
  "rslib.webview.page.config.mts",
]) {
  const text = readFileSync(join(here, "../vsc-ext", name), "utf8");
  assert(
    text.includes("worker-spawner$"),
    `${name} lost the exact-match worker-spawner$ alias`,
  );
  assert(
    !text.includes("worker-rewrites"),
    `${name} must not reference worker-rewrites`,
  );
}
assert(
  !existsSync(join(here, "../vsc-ext/rslib.webview.worker-rewrites.mts")),
  "rslib.webview.worker-rewrites.mts must stay deleted",
);

console.log("worker-arch-unify-03-spawn ok");
