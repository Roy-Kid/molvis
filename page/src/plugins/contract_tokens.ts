/**
 * Host design tokens for plugin UI.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  VENDORED FILE — source of truth is the molvis monorepo at
 *  `page/src/plugins/contract_tokens.ts`. Refresh copies with
 *  `node scripts/sync-plugin-contract.mjs`; CI checks them with `--check`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Plugins previously kept their own palettes — four of them, in two
 * incompatible representations (CSS `var()` strings for React, a parallel
 * `rgb()` table for canvas/xterm), with fallback chains naming host tokens
 * that do not exist (`var(--background)`, `var(--border)` — the host emits
 * `--color-background` / `--color-border`). Every dead rung meant the plugin
 * silently rendered a hardcoded light-theme hex inside dark chrome.
 *
 * Two rules make that class of bug impossible:
 *
 * 1. Anything CSS can style uses {@link token} — one `var()` chain, one
 *    fallback, defined once.
 * 2. Anything CSS cannot style (canvas 2D, xterm, WebGL) calls
 *    {@link resolveToken} at paint time, which reads the *computed* value
 *    from the live DOM. That follows the host's light/dark toggle for free,
 *    which a hardcoded second table never did.
 */

/**
 * Host token → fallback used only outside a MolVis page (standalone dev
 * server, storybook). Inside the host every `--molvis-*` is always defined,
 * so these values should never paint.
 */
const TOKEN_FALLBACK = {
  canvas: "#eef1f4",
  panel: "#fafbfc",
  panelRaised: "#eceff2",
  muted: "#e6eaee",
  foreground: "#283038",
  mutedForeground: "#5c666f",
  subtleForeground: "#7b848c",
  border: "#c8d0d8",
  input: "#c8d0d8",
  accent: "#288c82",
  accentForeground: "#f7fbfa",
  interactive: "#e4e9ed",
  interactiveForeground: "#283038",
  scrim: "rgba(24, 31, 47, 0.55)",
  shadowOverlay: "0 12px 32px rgba(0, 0, 0, 0.18)",
} as const;

/**
 * Status colours live under `--status-*`, not `--molvis-*`, so they need
 * their own prefix rather than a special case inside {@link tokenVar}.
 */
const STATUS_FALLBACK = {
  failed: "#b43c32",
  completed: "#328c5a",
  warning: "#b48c28",
  running: "#3c6ec8",
} as const;

export type TokenName = keyof typeof TOKEN_FALLBACK;
export type StatusName = keyof typeof STATUS_FALLBACK;

/** `--molvis-` custom-property name for a token. */
export function tokenVar(name: TokenName): string {
  const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `--molvis-${kebab}`;
}

/** CSS value for a status colour, e.g. `var(--status-failed-foreground, …)`. */
export function statusToken(name: StatusName): string {
  return `var(--status-${name}-foreground, ${STATUS_FALLBACK[name]})`;
}

/** CSS value for a token, e.g. `var(--molvis-panel, #fafbfc)`. */
export function token(name: TokenName): string {
  return `var(${tokenVar(name)}, ${TOKEN_FALLBACK[name]})`;
}

/**
 * Concrete colour for a token, resolved against the live DOM.
 *
 * For canvas / xterm / WebGL, which cannot consume `var()`. Call it at paint
 * time (not module load) so it tracks theme changes. `element` should be a
 * node inside the plugin's own subtree so any scoped theme applies.
 */
export function resolveToken(name: TokenName, element?: Element): string {
  const target =
    element ?? (typeof document === "undefined" ? null : document.body);
  if (!target || typeof getComputedStyle !== "function") {
    return TOKEN_FALLBACK[name];
  }
  const value = getComputedStyle(target).getPropertyValue(tokenVar(name));
  return value.trim() || TOKEN_FALLBACK[name];
}

/** Typography, matching the host chrome plugins render inside. */
export const FONT = {
  sans: "var(--molvis-ui-font, var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif))",
  mono: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)",
} as const;

/**
 * Stacking order for plugin chrome.
 *
 * Plugins used to pick z-indices independently (10000, 10050, 2147483000) so
 * their relative order was whatever the numbers happened to be. Anything the
 * host renders — dialogs, the command palette — sits above all of these, so
 * plugin content should stay inside its own band.
 */
export const Z = {
  /** Content that must clear its own panel (dropdowns, tooltips). */
  popover: 10,
  /** Plugin-local overlay inside a panel or dialog body. */
  overlay: 20,
} as const;
