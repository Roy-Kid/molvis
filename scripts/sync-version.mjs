#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
);
const version = rootPackage.version;

if (typeof version !== "string" || version.length === 0) {
  throw new Error("package.json must contain a non-empty version");
}

const packageTargets = [
  "core/package.json",
  "stage/package.json",
  "sketch/package.json",
  "umbrella/package.json",
  "page/package.json",
  "vsc-ext/package.json",
];

/** Published inter-package deps that must track the monorepo version. */
const pinSpecs = [
  {
    path: "stage/package.json",
    keys: ["@molcrafts/molvis-core"],
  },
  {
    path: "sketch/package.json",
    keys: ["@molcrafts/molvis-core"],
  },
  {
    path: "umbrella/package.json",
    keys: ["@molcrafts/molvis-stage", "@molcrafts/molvis-sketch"],
  },
];

let updated = 0;

function syncText(path, next) {
  const current = readFileSync(path, "utf8");
  if (current === next) return;
  updated += 1;
  const label = relative(repoRoot, path);
  writeFileSync(path, next);
  console.log(`updated ${label} -> ${version}`);
}

for (const target of packageTargets) {
  const path = join(repoRoot, target);
  const current = readFileSync(path, "utf8");
  const next = current.replace(
    /^(\s*"version"\s*:\s*")[^"]+("\s*,?)$/m,
    `$1${version}$2`,
  );
  if (next === current && !current.includes(`"version": "${version}"`)) {
    throw new Error(`${target} does not contain a JSON version field`);
  }
  syncText(path, next);
}

for (const { path: rel, keys } of pinSpecs) {
  const path = join(repoRoot, rel);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let dirty = false;
  for (const section of [
    "dependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    const bag = data[section];
    if (!bag) continue;
    for (const key of keys) {
      if (key in bag && bag[key] !== version) {
        bag[key] = version;
        dirty = true;
      }
    }
  }
  if (dirty) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
    updated += 1;
    console.log(`pinned deps in ${rel} -> ${version}`);
  }
}

const lockPath = join(repoRoot, "package-lock.json");
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.version = version;
  for (const target of ["", ...packageTargets.map((path) => dirname(path))]) {
    if (!lock.packages?.[target]) {
      throw new Error(
        `package-lock.json is missing workspace ${target || "<root>"}`,
      );
    }
    lock.packages[target].version = version;
  }
  syncText(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

const pyprojectPath = join(repoRoot, "python/pyproject.toml");
const pyproject = readFileSync(pyprojectPath, "utf8");
const nextPyproject = pyproject.replace(
  /(\[project\][\s\S]*?\nversion = ")[^"]+("\n)/,
  `$1${version}$2`,
);
if (
  nextPyproject === pyproject &&
  !pyproject.includes(`version = "${version}"`)
) {
  throw new Error("python/pyproject.toml is missing [project].version");
}
syncText(pyprojectPath, nextPyproject);

const installDocPath = join(repoRoot, "docs/interfaces/web/install.md");
const installDoc = readFileSync(installDocPath, "utf8");
const nextInstallDoc = installDoc.replace(
  /(@molcrafts\/molvis-stage@)[^/]+(\/dist\/viewer\.js)/,
  `$1${version}$2`,
);
if (
  nextInstallDoc === installDoc &&
  !installDoc.includes(`@molcrafts/molvis-stage@${version}/dist/viewer.js`)
) {
  throw new Error("docs/interfaces/web/install.md is missing the CDN version");
}
syncText(installDocPath, nextInstallDoc);

const elementsJsPath = join(
  repoRoot,
  "docs/assets/javascripts/molvis-elements.js",
);
if (existsSync(elementsJsPath)) {
  const elementsJs = readFileSync(elementsJsPath, "utf8");
  const nextElementsJs = elementsJs.replace(
    /(@molcrafts\/molvis-stage@)[^/"'\s]+(\/dist\/viewer\.js)/,
    `$1${version}$2`,
  );
  syncText(elementsJsPath, nextElementsJs);
}

console.log(
  `MolVis version ${version}: ${updated === 0 ? "in sync" : "synced"}`,
);
