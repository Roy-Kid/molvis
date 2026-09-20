/**
 * System wrap gate — a boolean on the pipeline after DataSource compose.
 *
 * Edge bonds are not folded here: Draws use {@code Box.delta} minimum-image
 * geometry on the post-gate frame. Do not reintroduce molecule-aware column
 * rewrites to "fix" straddling sticks.
 */

/** Legacy session / UI strings from the 2026-08 four-value policy. */
const LEGACY_WRAP_ON = new Set(["wrap", "wrap-atoms", "wrap-molecules"]);

/**
 * Map a stored or UI string to {@link wrapEnabled}.
 *
 * Unknown values and `"as-deposited"` / `"unwrap-trajectory"` → `false`
 * (unwrap is a separate Add-menu modifier, not a wrap state).
 */
export function wrapEnabledFromLegacy(value: string): boolean {
  return LEGACY_WRAP_ON.has(value);
}
