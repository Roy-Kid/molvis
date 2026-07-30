#!/usr/bin/env node
/**
 * Post-build pack gate for `@molcrafts/molvis-stage`.
 *
 * Catches the class of failure that shipped in 0.0.11: the CDN `viewer`
 * entry bundled Babylon Inspector / gui-editor (multi-MB debug UI that molvis
 * never uses) because a dynamic import survived into the rspack graph and
 * neither CI nor pre-commit looked at the published tarball contents.
 *
 * Invoked by `npm run check:pack` / `release:check`. Failures are hard —
 * do not publish with banned packages or a bloated viewer surface.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/**
 * Budget for the whole viewer CDN surface (entry + async chunks + wasm).
 * 0.0.11 shipped ~38MB of JS alone because of inspector; a healthy build
 * with core/gui/materials/molvis-core/molrs should land well under this.
 */
const ELEMENTS_TOTAL_BUDGET_BYTES = 25 * 1024 * 1024;

/**
 * Hard ban on Babylon debug-tooling artifact names.
 * Deliberately does NOT match `data_inspector` (our own frame-table panel).
 */
const BANNED_FILE_RE =
  /(?:^|[/\\])(?:1~)?(?:@babylonjs\/)?(?:inspector|gui-editor)(?:[/\\.]|$)|babylon\.guiEditor|guiEditor/i;

async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw new Error(
        `dist/ missing — run \`npm run build\` before check:pack (${DIST})`,
      );
    }
    throw err;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walk(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(DIST, file).split(path.sep).join("/");
}

async function main() {
  const files = await walk(DIST);
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  // 1. Banned path names
  for (const file of files) {
    const r = rel(file);
    if (BANNED_FILE_RE.test(r)) {
      errors.push(`banned artifact in dist/: ${r}`);
    }
  }

  // 2. Banned content in JS (catches re-exports / dynamic import strings)
  const bannedContent = [
    /@babylonjs\/inspector\b/,
    /@babylonjs\/gui-editor\b/,
    /@babylonjs\/loaders\b/,
    /babylon\.guiEditor/,
  ];
  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const r = rel(file);
    if (r.endsWith(".LICENSE.txt")) continue;
    const text = await readFile(file, "utf8");
    for (const re of bannedContent) {
      if (re.test(text)) {
        errors.push(`banned package reference in ${r} (${re})`);
        break;
      }
    }
  }

  // 3. viewer entry must exist and not be an empty stub without its graph
  const viewerEntry = path.join(DIST, "viewer.js");
  try {
    const st = await stat(viewerEntry);
    if (st.size === 0) {
      errors.push("dist/viewer.js is empty");
    }
  } catch {
    errors.push("dist/viewer.js missing — viewer CDN entry did not build");
  }

  // 4. Size budget over JS+wasm under dist that the CDN entry can pull
  //    (everything except .d.ts / LICENSE). This is a regression tripwire,
  //    not a perfect tree-shaker.
  let total = 0;
  for (const file of files) {
    if (file.endsWith(".d.ts") || file.endsWith(".LICENSE.txt")) continue;
    if (!/\.(js|wasm|mjs)$/.test(file)) continue;
    // Unbundled library modules (app.js, world.js, …) are external-deps for
    // npm consumers and are not loaded by the CDN viewer entry. Only count
    // the bundled viewer surface: viewer.js, numeric chunk ids, `1~*`,
    // and static/wasm.
    const r = rel(file);
    const isElementsSurface =
      r === "viewer.js" ||
      /^[0-9]+\.js$/.test(r) ||
      r.startsWith("1~") ||
      r.startsWith("static/");
    if (!isElementsSurface) continue;
    total += (await stat(file)).size;
  }
  if (total > ELEMENTS_TOTAL_BUDGET_BYTES) {
    errors.push(
      `viewer CDN surface is ${(total / 1024 / 1024).toFixed(1)}MB ` +
        `(budget ${(ELEMENTS_TOTAL_BUDGET_BYTES / 1024 / 1024).toFixed(0)}MB) — ` +
        `debug tooling or accidental deps likely reintroduced`,
    );
  } else {
    warnings.push(
      `viewer CDN surface: ${(total / 1024 / 1024).toFixed(1)}MB ` +
        `(budget ${(ELEMENTS_TOTAL_BUDGET_BYTES / 1024 / 1024).toFixed(0)}MB)`,
    );
  }

  for (const w of warnings) {
    console.log(`check:pack warn: ${w}`);
  }
  if (errors.length) {
    console.error("check:pack FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("check:pack ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
