/**
 * Host-owned open state for plugin dialogs.
 *
 * Plugins register content via `api.dialogs`; they open dialogs through
 * `commands.register(..., { toolbar: { opensDialog } })` or by calling
 * {@link openPluginDialog}. The shell ({@link PluginDialogHost}) subscribes
 * and renders the matching contribution.
 */

import type { ContributionListener } from "./store";

let openDialogId: string | null = null;
const listeners = new Set<ContributionListener>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error("[molvis-plugins] dialog host listener failed", err);
    }
  }
}

export function openPluginDialog(id: string): void {
  if (!id) return;
  if (openDialogId === id) return;
  openDialogId = id;
  emit();
}

export function closePluginDialog(): void {
  if (openDialogId === null) return;
  openDialogId = null;
  emit();
}

export function getOpenPluginDialogId(): string | null {
  return openDialogId;
}

export function subscribePluginDialogHost(
  listener: ContributionListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
