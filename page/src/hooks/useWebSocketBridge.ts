import { EventForwarder } from "@/lib/event-forwarder";
import type { MountOpts } from "@/lib/mount-opts";
import { WebSocketBridge } from "@/lib/ws-bridge";
import type { Molvis } from "@molvis/core";
import { useEffect } from "react";

/**
 * Connect the page app to a controller (Python / other language) via
 * WebSocket when the mount opts include a `wsUrl`.
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

    const bridge = new WebSocketBridge(app);
    const forwarder = new EventForwarder(bridge, app);

    let cancelled = false;

    bridge
      .connect(wsUrl, token ?? "", session ?? "default")
      .then(() => {
        if (cancelled) {
          bridge.disconnect();
          return;
        }
        forwarder.start();
      })
      .catch((err) => {
        console.error("Failed to connect WebSocket bridge:", err);
      });

    return () => {
      cancelled = true;
      forwarder.stop();
      bridge.disconnect();
    };
  }, [app, wsUrl, token, session]);
}
