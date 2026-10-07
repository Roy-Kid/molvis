/**
 * `.gitignore` matching for the Files tree.
 *
 * Kept free of `vscode` (and of the stage package) so the mocha unit runner
 * can load it as CommonJS — the same constraint that keeps `molecularMatch`'s
 * extension list local.
 *
 * This is git's pattern language, not a glob library: a pattern with no slash
 * matches a name at any depth, one with a slash is anchored to the directory
 * holding the `.gitignore`, a trailing slash restricts it to directories, and
 * a leading `!` un-ignores. Rules read in order and the **last** match wins,
 * which is what makes `!keep.me` after `*.log` work.
 *
 * What it deliberately does not do: `.git/info/exclude`, the global
 * `core.excludesFile`, or `$GIT_DIR/info/sparse-checkout`. A tree view that
 * hides a directory the user can see in the Explorer is worse than one that
 * shows a directory git happens to ignore, so the scope stops at the files
 * that sit in the worktree next to what they describe.
 */

/** One parsed `.gitignore` line, anchored to the directory that declared it. */
export interface IgnoreRule {
  /** `!pattern` — a match un-ignores instead of ignoring. */
  readonly negated: boolean;
  /** `pattern/` — matches directories only. */
  readonly dirOnly: boolean;
  /** Directory the declaring `.gitignore` sits in, workspace-relative (`""` at the root). */
  readonly base: string;
  readonly regex: RegExp;
  /** The line as written, for debugging a surprising hide. */
  readonly source: string;
}

/** Escape everything a regex treats specially except the glob metacharacters. */
function escapeLiteral(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Translate one git pattern body into a regex over a path relative to the
 * declaring directory.
 *
 * `**` spans separators, `*` and `?` do not — the distinction is the whole
 * reason this cannot be a plain `RegExp` conversion of `*` to `.*`.
 */
function patternToRegex(body: string, anchored: boolean): RegExp {
  let stars = 0;
  for (const c of body) {
    if (c === "*") stars += 1;
  }
  if (body.length > 256 || stars > 8) {
    return /$^/;
  }
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "*") {
      if (body[i + 1] === "*") {
        // `**/` swallows any number of leading segments, `**` alone spans them.
        i++;
        if (body[i + 1] === "/") {
          i++;
          out += "(?:.*/)?";
        } else {
          out += ".*";
        }
      } else {
        out += "[^/]*";
      }
      continue;
    }
    if (c === "?") {
      out += "[^/]";
      continue;
    }
    if (c === "[") {
      const close = body.indexOf("]", i + 1);
      if (close > i) {
        const set = body.slice(i + 1, close).replace(/\\/g, "\\\\");
        out += `[${set.startsWith("!") ? `^${set.slice(1)}` : set}]`;
        i = close;
        continue;
      }
      out += "\\[";
      continue;
    }
    out += escapeLiteral(c);
  }
  // An unanchored pattern matches at any depth; an anchored one starts here.
  const prefix = anchored ? "" : "(?:.*/)?";
  // A match on a directory also covers everything under it.
  return new RegExp(`^${prefix}${out}(?:/.*)?$`);
}

/**
 * Parse the text of one `.gitignore`. `base` is the directory it sits in,
 * workspace-relative and separator-free at the root (`""`, `"src"`, `"a/b"`).
 */
export function parseGitignore(text: string, base = ""): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "");
    // A comment or a blank line is not a rule. Trailing spaces are stripped
    // unless escaped, which is git's rule and not a detail we can skip: a
    // pattern that ends in an escaped space is a real filename.
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    let body = line.replace(/(?<!\\)\s+$/, "");
    if (!body) continue;

    let negated = false;
    if (body.startsWith("!")) {
      negated = true;
      body = body.slice(1);
    } else if (body.startsWith("\\!")) {
      body = body.slice(1);
    }

    let dirOnly = false;
    if (body.endsWith("/")) {
      dirOnly = true;
      body = body.slice(0, -1);
    }
    if (!body) continue;

    // A slash anywhere but the end anchors the pattern to `base`.
    const anchored = body.includes("/");
    if (body.startsWith("/")) body = body.slice(1);

    rules.push({
      negated,
      dirOnly,
      base,
      regex: patternToRegex(body, anchored),
      source: line,
    });
  }
  return rules;
}

/**
 * The rules in force at one point in the tree.
 *
 * Immutable and cheap to extend: descending a directory produces a new stack
 * carrying that directory's `.gitignore` on top, so a tree that is walked
 * lazily never has to re-read an ancestor.
 */
export class IgnoreStack {
  private constructor(private readonly rules: readonly IgnoreRule[]) {}

  static empty(): IgnoreStack {
    return new IgnoreStack([]);
  }

  /** A new stack with `text`'s rules, declared in the directory `base`. */
  extend(base: string, text: string): IgnoreStack {
    const added = parseGitignore(text, base);
    return added.length === 0
      ? this
      : new IgnoreStack([...this.rules, ...added]);
  }

  get size(): number {
    return this.rules.length;
  }

  /**
   * Whether `relPath` (workspace-relative, `/`-separated, no leading slash) is
   * ignored. Later rules win, so a negation only has to come after the rule it
   * undoes — exactly git's precedence.
   */
  ignores(relPath: string, isDir: boolean): boolean {
    let ignored = false;
    for (const rule of this.rules) {
      if (rule.dirOnly && !isDir) continue;
      const scoped = scopeTo(rule.base, relPath);
      if (scoped === undefined) continue;
      if (rule.regex.test(scoped)) ignored = !rule.negated;
    }
    return ignored;
  }
}

/** `relPath` seen from `base`, or `undefined` when it is not under it. */
function scopeTo(base: string, relPath: string): string | undefined {
  if (base === "") return relPath;
  const prefix = `${base}/`;
  return relPath.startsWith(prefix) ? relPath.slice(prefix.length) : undefined;
}
