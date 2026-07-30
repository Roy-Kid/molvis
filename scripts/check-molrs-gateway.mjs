#!/usr/bin/env node
/**
 * Enforce: only core/ may import @molcrafts/molrs.
 * Exit 1 if any other package source does.
 */
import { execSync } from "node:child_process";

const out = execSync(
  `grep -rn '@molcrafts/molrs' --include='*.ts' --include='*.tsx' --include='*.mts' --include='*.js' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=site --exclude-dir=.git . || true`,
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);

const offenders = out
  .split("\n")
  .filter(Boolean)
  .filter((line) => {
    // allow core package + this script + docs notes
    if (line.startsWith("./core/")) return false;
    if (line.includes("check-molrs-gateway")) return false;
    if (line.includes(".claude/")) return false;
    if (line.includes("package-architecture")) return false;
    // Staged docs CDN artifacts (old engine bundles); regenerated on docs build.
    if (line.startsWith("./docs/assets/")) return false;
    if (line.startsWith("./site/assets/")) return false;
    // Mentions in comments only inside stage rslib are ok if not imports —
    // still flag real imports via path filter below.
    if (line.startsWith("./package.json")) return false;
    if (line.startsWith("./package-lock.json")) return false;
    // Allow prose in README that documents the ban.
    if (line.includes("README.md:")) return false;
    // Config comment lines that only mention the ban.
    if (line.includes("Never import") || line.includes("must not import"))
      return false;
    return true;
  });

if (offenders.length) {
  console.error("Direct @molcrafts/molrs imports outside core/:\n");
  for (const line of offenders) console.error(line);
  process.exit(1);
}

console.log("OK: only core/ imports @molcrafts/molrs");
