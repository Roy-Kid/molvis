import type { PageSurface } from "../../protocol";

/**
 * Mount options handed to the page before its bundle runs.
 *
 * Only `surface` today. It has to arrive this way rather than on `init`: a
 * panel that wants chrome off needs it at first paint, and `init` cannot land
 * before the shell has mounted and posted `ready` — the page would paint full
 * chrome and then collapse. `init.surface` stays the run-time channel.
 *
 * Free of `vscode` imports so the unit lane can load it.
 */
export interface PageMountInject {
  surface?: PageSurface;
}

/**
 * The `<script>` that seeds `window.__MOLVIS_VSCODE_INIT__.mount`, or `""`.
 *
 * Empty for a caller that asks for nothing, so the global does not quietly
 * become mandatory for every page surface. Merges rather than assigns: other
 * hosts put `config` / `settings` on the same global.
 */
export function renderMountInject(
  nonce: string,
  mount: PageMountInject | undefined,
): string {
  if (!mount || Object.keys(mount).length === 0) return "";
  return `<script nonce="${nonce}">window.__MOLVIS_VSCODE_INIT__ = Object.assign(window.__MOLVIS_VSCODE_INIT__ || {}, { mount: ${JSON.stringify(mount)} });</script>`;
}
