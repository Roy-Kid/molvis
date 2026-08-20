/**
 * Unit tests for `src/webview/worker_spawner.ts` — the alias target that
 * replaces the stage `@molcrafts/molvis-stage/worker-spawner` subpath in
 * webview builds (spec worker-arch-unify-03-spawn, ac-006).
 *
 * Deviation from the spec's "module fakes" wording, stated openly: this
 * suite asserts on the module's source text (same mechanism as
 * `tests/unit/extension/manifest.test.ts`) instead of importing it.
 * The mocha/tsc lane compiles under module Node16 → CommonJS, where the
 * module's `import.meta.url` href derivation is a hard compile error, and
 * the repo has no module-mocking infra (no proxyquire/esmock; node:test
 * `mock.module` is unavailable under mocha). A static import would break
 * `test:compile` for the whole suite; text-level assertions bind the same
 * contract — async exports with seam-identical signatures, compute →
 * spawnWebviewWorkerFromHref ("…/compute-worker.js", "molvis-compute"),
 * trajectory → spawnWebviewWorkerLoadingWasm ("…/worker.js",
 * `trajectory-${format}`) returning a TrajectoryRuntime — without pulling
 * the module into the CJS compile graph.
 *
 * The source is read lazily inside each test so a missing module fails
 * these tests with a clear message instead of aborting suite collection.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as assert from "assert";

/**
 * Walk up to the extension root rather than counting `..` segments — the
 * compiled tests live under `out-test/`, so a fixed depth silently breaks
 * whenever the emit layout changes.
 */
function extensionRoot(): string {
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json")) && dir.endsWith("vsc-ext")) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(`could not locate vsc-ext root from ${__dirname}`);
}

function workerSpawnerSource(): string {
  const path = join(extensionRoot(), "src", "webview", "worker_spawner.ts");
  assert.ok(
    existsSync(path),
    `src/webview/worker_spawner.ts does not exist yet ` +
      `(spec worker-arch-unify-03-spawn: alias target module not implemented)`,
  );
  return readFileSync(path, "utf8");
}

suite("webview worker_spawner (alias target)", () => {
  test("exports async spawnComputeWorker with the stage seam signature", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /export async function spawnComputeWorker\(\s*\)\s*:\s*Promise<Worker>/,
      "spawnComputeWorker must be an exported async function returning Promise<Worker>",
    );
  });

  test("exports async spawnTrajectoryWorker with the stage seam signature", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /export async function spawnTrajectoryWorker\(\s*format\s*:\s*Format\s*,?\s*\)\s*:\s*Promise<TrajectoryRuntime>/,
      "spawnTrajectoryWorker must be an exported async function (format: Format) => Promise<TrajectoryRuntime>",
    );
  });

  test("delegates to the existing blob bootstrap paths in ./spawnWebviewWorker", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /import\s*\{[^}]*spawnWebviewWorkerFromHref[^}]*\}\s*from\s*["']\.\/spawnWebviewWorker["']/s,
      "must import spawnWebviewWorkerFromHref from ./spawnWebviewWorker",
    );
    assert.match(
      src,
      /import\s*\{[^}]*spawnWebviewWorkerLoadingWasm[^}]*\}\s*from\s*["']\.\/spawnWebviewWorker["']/s,
      "must import spawnWebviewWorkerLoadingWasm from ./spawnWebviewWorker",
    );
  });

  test("compute path spawns ./compute-worker.js named molvis-compute via FromHref", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /spawnWebviewWorkerFromHref\(/,
      "spawnComputeWorker must call spawnWebviewWorkerFromHref",
    );
    assert.ok(
      src.includes('"./compute-worker.js"'),
      'compute worker href must end with "compute-worker.js" (chunk-relative)',
    );
    assert.ok(
      src.includes('"molvis-compute"'),
      'compute worker name must be "molvis-compute"',
    );
  });

  test("trajectory path spawns ./worker.js named trajectory-<format> via LoadingWasm", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /spawnWebviewWorkerLoadingWasm\(/,
      "spawnTrajectoryWorker must call spawnWebviewWorkerLoadingWasm",
    );
    assert.ok(
      src.includes('"./worker.js"'),
      'trajectory worker href must end with "worker.js" (chunk-relative)',
    );
    assert.ok(
      src.includes("`trajectory-${format}`"),
      "trajectory worker name must be `trajectory-${format}` (e.g. trajectory-xyz)",
    );
  });

  test("trajectory path wraps the worker in a TrajectoryRuntime", () => {
    const src = workerSpawnerSource();
    assert.match(
      src,
      /new TrajectoryRuntime\(/,
      "spawnTrajectoryWorker must return a TrajectoryRuntime instance",
    );
    assert.match(
      src,
      /from\s*["']@molcrafts\/molvis-stage\/trajectory-runtime["']/,
      "TrajectoryRuntime must come from the frozen stage subpath export",
    );
  });
});
