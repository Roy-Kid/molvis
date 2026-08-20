/**
 * MolVis mask file — a compact UTF-8 text file describing an atom selection
 * by atom `id` (the molrs canonical `id` column, u32).
 *
 * molrs and molvis share one internal convention: an atom's identity is its
 * `id` column value, preserved exactly as molrs read it. A mask stores those
 * ids verbatim — it never stores row indices and never re-indexes them, so a
 * mask written for one frame round-trips through a later frame as long as the
 * ids still exist.
 *
 * One file = one mask (a set of atom ids). This module is the single
 * parser/writer; it is intentionally free of any rendering or WASM
 * dependency so hosts (page, vsc-ext, Python RPC path) can import it cheaply
 * — same rationale as `io/formats.ts`.
 *
 * Grammar:
 *   - `#` starts a comment to end of line (full-line and trailing).
 *   - Blank lines are ignored.
 *   - Tokens are separated by whitespace, commas, or semicolons.
 *   - Every token is a non-negative integer = a selected atom id.
 *   - Duplicates are ignored; the result is sorted ascending.
 *   - Optional `@atoms <N>` directive (at most once) declares the atom count
 *     the file was written for; it enables a loud mismatch check at
 *     validation time.
 */

export const MASK_FILE_EXTENSION = "mask";
export const MASK_FILE_ACCEPT = ".mask";

export interface MaskFileParseResult {
  /** Selected atom ids, sorted ascending and deduplicated. */
  ids: number[];
  /** Value of the optional `@atoms` directive, or null. */
  expectedCount: number | null;
}

export class MaskFileSyntaxError extends Error {
  /** 1-based line number, or 0 when no specific line applies. */
  readonly line: number;

  constructor(message: string, line = 0) {
    super(line > 0 ? `line ${line}: ${message}` : message);
    this.name = "MaskFileSyntaxError";
    this.line = line;
  }
}

const NONNEG_INT = /^(0|[1-9][0-9]*)$/;
const DIRECTIVE_PREFIX = "@atoms";

function parseCount(token: string, line: number): number {
  const match = /^(\d+)$/.exec(token);
  if (!match) {
    throw new MaskFileSyntaxError(
      `invalid @atoms directive; expected "@atoms <count>"`,
      line,
    );
  }
  const value = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(value)) {
    throw new MaskFileSyntaxError(`@atoms count is not a safe integer`, line);
  }
  return value;
}

/**
 * Parse mask file text. Throws {@link MaskFileSyntaxError} on malformed
 * content; never silently skips a token it cannot interpret.
 */
export function parseMaskFile(text: string): MaskFileParseResult {
  const ids = new Set<number>();
  let expectedCount: number | null = null;

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const commentAt = lines[i].indexOf("#");
    const content = (
      commentAt >= 0 ? lines[i].slice(0, commentAt) : lines[i]
    ).trim();
    if (content === "") continue;

    if (content.startsWith(DIRECTIVE_PREFIX)) {
      if (expectedCount !== null) {
        throw new MaskFileSyntaxError("duplicate @atoms directive", lineNumber);
      }
      const rest = content.slice(DIRECTIVE_PREFIX.length).trim();
      if (rest.split(/\s+/).length !== 1) {
        throw new MaskFileSyntaxError(
          `invalid @atoms directive; expected "@atoms <count>"`,
          lineNumber,
        );
      }
      expectedCount = parseCount(rest, lineNumber);
      continue;
    }

    for (const token of content.split(/[\s,;]+/)) {
      if (token === "") continue;
      if (!NONNEG_INT.test(token)) {
        throw new MaskFileSyntaxError(
          `expected a non-negative integer, got "${token}"`,
          lineNumber,
        );
      }
      const value = Number.parseInt(token, 10);
      if (!Number.isSafeInteger(value)) {
        throw new MaskFileSyntaxError(
          `id is not a safe integer: "${token}"`,
          lineNumber,
        );
      }
      ids.add(value);
    }
  }

  return {
    ids: [...ids].sort((a, b) => a - b),
    expectedCount,
  };
}

export interface SerializeMaskFileOptions {
  /** When set, emits the `@atoms` directive with this count. */
  atomCount?: number | null;
}

/** Number of ids per line in the canonical writer. */
const IDS_PER_LINE = 15;

/**
 * Canonical mask-file writer. Sorts and deduplicates, then emits one
 * space-separated line per {@link IDS_PER_LINE} ids. Round-trips through
 * {@link parseMaskFile} up to canonicalization.
 */
export function serializeMaskFile(
  input: readonly number[],
  options: SerializeMaskFileOptions = {},
): string {
  const ids = [...new Set(input)].sort((a, b) => a - b);
  const lines: string[] = [
    '# MolVis mask file v1 — atom ids (molrs "id" column, u32)',
  ];
  if (options.atomCount != null) {
    lines.push(`@atoms ${options.atomCount}`, "");
  }
  for (let i = 0; i < ids.length; i += IDS_PER_LINE) {
    lines.push(ids.slice(i, i + IDS_PER_LINE).join(" "));
  }
  return `${lines.join("\n")}\n`;
}
