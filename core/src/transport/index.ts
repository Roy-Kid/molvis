/**
 * Transport subsystem: connects a local `MolvisApp` to a remote
 * controller (Python or any other language) over a WebSocket. See
 * `ws_bridge.ts` for the wire-level handshake and
 * `rpc/router.ts` for the JSON-RPC dispatch table.
 */

import type { MolvisApp } from "../app";
import { EventForwarder } from "./event_forwarder";
import { WebSocketBridge } from "./ws_bridge";

export { WebSocketBridge, type BridgeConnectResult } from "./ws_bridge";
export { EventForwarder } from "./event_forwarder";
export { RPCRouter } from "./rpc/router";
export { applyBackendState } from "./state_sync";
export type {
  JsonRPCRequest,
  JsonRPCResponse,
  BinaryBufferRef,
  SerializedFrameData,
  SerializedBoxData,
  RPCResponseEnvelope,
} from "./rpc/types";

export interface AttachWebSocketBridgeOpts {
  /** WebSocket URL served by the Python-side transport. */
  wsUrl: string;
  /** Token embedded in the page URL; validated during handshake. */
  token?: string;
  /** Logical session id sent with the hello frame. Defaults to "default". */
  session?: string;
  /**
   * Called if the handshake fails. Defaults to `console.error`; supply
   * this to plug into a host-specific error channel (VSCode status bar,
   * notebook cell output, …) instead.
   */
  onError?: (err: unknown) => void;
  /**
   * Called after the hello handshake completes successfully and the
   * event forwarder has been started. Use this to flip UI state from
   * "connecting" to "connected".
   */
  onConnected?: () => void;
}

/**
 * Attach a WebSocket bridge to the given app. Connects, starts forwarding
 * core events once `ready` is received, and returns a disposer that
 * stops the forwarder and closes the socket (safe to call from a React
 * effect cleanup, `beforeunload`, etc.).
 *
 * The returned disposer is idempotent and safe to call before the
 * handshake completes — in-flight sockets are cancelled.
 */
export function attachWebSocketBridge(
  app: MolvisApp,
  opts: AttachWebSocketBridgeOpts,
): () => void {
  const bridge = new WebSocketBridge(app);
  const forwarder = new EventForwarder(bridge, app);
  let cancelled = false;

  bridge
    .connect(opts.wsUrl, opts.token ?? "", opts.session ?? "default")
    .then(() => {
      if (cancelled) {
        bridge.disconnect();
        return;
      }
      forwarder.start();
      opts.onConnected?.();
      // Ask the controller for whatever it last pushed — the reply
      // arrives as a ``scene.apply_state`` RPC which the router turns
      // into a ``backend-state-sync`` event on the app bus.
      bridge.sendEvent("event.request_state_sync", {});
    })
    .catch((err) => {
      if (opts.onError) {
        opts.onError(err);
      } else {
        console.error("Failed to connect WebSocket bridge:", err);
      }
    });

  return () => {
    cancelled = true;
    forwarder.stop();
    bridge.disconnect();
  };
}
