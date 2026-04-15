import { WebSocketBridge } from "@/lib/ws-bridge";
import type { Molvis } from "@molvis/core";
import { useEffect } from "react";

/**
 * Connects the page app to a Python MolVis server via WebSocket
 * when the `?ws=1` query parameter is present.
 */
export function useWebSocketBridge(app: Molvis | null): void {
  useEffect(() => {
    if (!app) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!params.has("ws")) {
      return;
    }

    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${window.location.host}/ws`;
    const bridge = new WebSocketBridge(app);

    bridge.connect(wsUrl).catch((err) => {
      console.error("Failed to connect WebSocket bridge:", err);
    });

    return () => {
      bridge.disconnect();
    };
  }, [app]);
}

/**
 * Returns true when the page is running in WebSocket-controlled mode
 * (launched from Python's `show()`).
 */
export function isWebSocketMode(): boolean {
  return new URLSearchParams(window.location.search).has("ws");
}
