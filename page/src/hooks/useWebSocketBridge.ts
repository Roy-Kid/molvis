import type { MountOpts } from "@/lib/mount-opts";
import { attachWebSocketBridge } from "@molvis/core";
import type { Molvis } from "@molvis/core";
import { useEffect } from "react";

/**
 * Connect the page app to a controller (Python / other language) via
 * WebSocket when the mount opts include a `wsUrl`.
 *
 * The WS client, JSON-RPC router, and event forwarder all live in
 * `@molvis/core`; this hook is only the React lifecycle glue.
 *
 * If `wsUrl` is missing, the hook is a no-op — the page runs its local
 * demo via {@link useBootstrapDemo}.
 */
export function useWebSocketBridge(app: Molvis | null, opts: MountOpts): void {
  const { wsUrl, token, session } = opts;

  useEffect(() => {
    if (!app || !wsUrl) {
      return;
    }
    const dispose = attachWebSocketBridge(app, { wsUrl, token, session });
    return dispose;
  }, [app, wsUrl, token, session]);
}
