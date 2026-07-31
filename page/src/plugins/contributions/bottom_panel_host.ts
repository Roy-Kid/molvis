/**
 * Imperative focus/open for bottom plugin panels (command palette, etc.).
 * BottomPanelHost subscribes and expands + selects the requested panel.
 */

type Listener = () => void;

let requestSeq = 0;
let lastRequest: { id: string; seq: number } | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

/** Open/focus a bottom panel by namespaced id (e.g. `plugin.com….console`). */
export function openBottomPanel(id: string): void {
  lastRequest = { id, seq: ++requestSeq };
  emit();
}

export function getBottomPanelOpenRequest(): {
  id: string;
  seq: number;
} | null {
  return lastRequest;
}

export function subscribeBottomPanelHost(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
