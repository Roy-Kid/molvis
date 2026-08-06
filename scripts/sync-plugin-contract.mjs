#!/usr/bin/env node
/**
 * DEPRECATED for new plugins.
 *
 * Plugin authors should depend on `@molcrafts/molvis/plugin` (or
 * `@molcrafts/molvis-plugin`) and scaffold with
 * `npx @molcrafts/create-molvis-plugin`. Do not vendor `page/` files.
 *
 * This script remains for legacy official/plugin checkouts that still
 * carry byte-identical contract copies. Prefer migrating them to the
 * published SDK.
 *
 * Vendor the plugin contract + UI kit into the template and plugin repos.
 *
 * Sources of truth (molvis monorepo only — never edit consumer copies):
 *
 *   page/src/plugins/contract*.ts     → contract types / tokens
 *   page/src/plugins/kit/*            → shadcn components.json, externals
 *   page/src/lib/utils.ts             → cn()
 *   page/src/components/ui/{button,checkbox,select}.tsx
 *                                     → host-aligned shadcn primitives
 *
 *   node scripts/sync-plugin-contract.mjs           # write copies
 *   node scripts/sync-plugin-contract.mjs --check   # fail on drift (CI)
 *
 * Extra target roots may be passed as positional args; otherwise the sibling
 * checkouts listed in DEFAULT_TARGETS are used when they exist.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Host path → path inside every consumer (contract + tokens + check script). */
const VENDORED_ALL = [
  ["page/src/plugins/contract.ts", "src/types/contract.ts"],
  ["page/src/plugins/contract_testing.ts", "src/types/contract_testing.ts"],
  ["page/src/plugins/contract_tokens.ts", "src/types/contract_tokens.ts"],
  [
    "scripts/vendored/check-vendored-contract.mjs",
    "scripts/check-vendored-contract.mjs",
  ],
];

/**
 * Host path → path inside package roots that own a shadcn tree
 * (template + official collection). Child plugin packages share the
 * collection's `src/components` via the monorepo tsconfig paths.
 */
const VENDORED_UI_KIT = [
  ["page/src/plugins/kit/components.json", "components.json"],
  ["page/src/plugins/kit/shadcn.css", "src/styles/shadcn.css"],
  ["page/src/plugins/kit/externals.ts", "plugin-externals.ts"],
  ["page/src/lib/utils.ts", "src/lib/utils.ts"],
  ["page/src/components/ui/button.tsx", "src/components/ui/button.tsx"],
  ["page/src/components/ui/checkbox.tsx", "src/components/ui/checkbox.tsx"],
  ["page/src/components/ui/select.tsx", "src/components/ui/select.tsx"],
];

/** Written alongside the copies so consumers can self-check offline. */
const LOCK_PATH = "src/types/contract.lock.json";

/** Sibling checkouts that vendor the contract. Missing ones are skipped. */
const DEFAULT_TARGETS = [
  "../molvis-plugin-template",
  "../molvis-plugins-official",
  "../molvis-plugins-official/plugins/alchemist",
  "../molvis-plugins-official/plugins/carbon-tube-builder",
  "../molvis-plugins-official/plugins/lammps-input-generator",
  "../molvis-plugins-official/plugins/pyodide-molpy",
];

/** Roots that receive the full shadcn + externals kit. */
const UI_KIT_TARGETS = new Set(
  [
    resolve(repoRoot, "../molvis-plugin-template"),
    resolve(repoRoot, "../molvis-plugins-official"),
  ].map((p) => p),
);

/**
 * Plugin-side binding for `./engine`. Written once if absent, then left
 * alone — a repo may need to point somewhere else while the contract itself
 * stays identical everywhere.
 */
const ENGINE_BINDING = `/**
 * Engine types the plugin contract refers to — **plugin binding**.
 *
 * \`contract.ts\` is vendored verbatim from the molvis monorepo and must not
 * name a package only the host can resolve, so it imports these four names
 * from here. This file is the one place a plugin repo decides where they
 * come from; \`sync-plugin-contract.mjs\` never overwrites it.
 *
 * Prefer sibling monorepo \`file:../molvis/stage\` (or published stage).
 * When \`@molcrafts/molvis-plugin-api\` ships, only this file changes.
 */
import type { Modifier, Molvis, Overlay } from "@molcrafts/molvis-stage";

export type { Modifier, Molvis, Overlay };

/**
 * Factory for a plugin interaction mode.
 *
 * The host's real signature returns \`BaseMode\`, which is not reachable from
 * a plugin package. Returning \`unknown\` here is deliberate: a *narrower*
 * local guess would be a second copy of the engine contract, which is the
 * drift this vendoring exists to stop.
 */
export type PluginModeFactory = (app: Molvis) => unknown;
`;

const checkOnly = process.argv.includes("--check");
const explicit = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = (explicit.length > 0 ? explicit : DEFAULT_TARGETS)
  .map((t) => resolve(repoRoot, t))
  .filter((t) => {
    if (existsSync(t)) return true;
    console.log(`skip (not checked out): ${t}`);
    return false;
  });

function hashText(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function loadSources(pairs) {
  return pairs.map(([from, to]) => {
    const text = readFileSync(join(repoRoot, from), "utf8");
    const hash = hashText(text);
    console.log(`${from} sha256:${hash}`);
    return { from, to, text, hash };
  });
}

const contractSources = loadSources(VENDORED_ALL);
const kitSources = loadSources(VENDORED_UI_KIT);

let drifted = 0;

function syncFile(target, label, { to, text }) {
  const dest = join(target, to);
  const current = existsSync(dest) ? readFileSync(dest, "utf8") : null;
  if (current === text) {
    console.log(`  ok    ${label}/${to}`);
    return;
  }
  drifted += 1;
  if (checkOnly) {
    const how = current === null ? "missing" : "differs from";
    console.error(`  DRIFT ${label}/${to} — ${how} the host copy`);
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    console.log(`  wrote ${label}/${to}`);
  }
}

for (const target of targets) {
  const label = relative(resolve(repoRoot, ".."), target);
  const sources = [...contractSources];
  if (UI_KIT_TARGETS.has(target)) {
    sources.push(...kitSources);
  }

  for (const src of sources) {
    syncFile(target, label, src);
  }

  const enginePath = join(target, "src/types/engine.ts");
  if (!existsSync(enginePath) && !checkOnly) {
    mkdirSync(dirname(enginePath), { recursive: true });
    writeFileSync(enginePath, ENGINE_BINDING);
    console.log(`  wrote ${label}/src/types/engine.ts (binding, edit freely)`);
  }

  if (!checkOnly) {
    const lock = {
      note: "Generated by molvis scripts/sync-plugin-contract.mjs — do not edit.",
      contractVersion: contractSources[0].hash,
      files: Object.fromEntries(sources.map((s) => [s.to, s.hash])),
    };
    writeFileSync(
      join(target, LOCK_PATH),
      `${JSON.stringify(lock, null, 2)}\n`,
    );
  }
}

if (drifted > 0 && checkOnly) {
  console.error(
    "\nVendored plugin contracts / UI kit are stale. From the molvis repo run:\n" +
      "  node scripts/sync-plugin-contract.mjs",
  );
  process.exit(1);
}
if (drifted === 0) console.log("all vendored contracts + UI kit in sync");
