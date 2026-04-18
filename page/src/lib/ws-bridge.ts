/**
 * WebSocket bridge connecting the page to a Python (or other language) MolVis
 * controller.
 *
 * The page is a generic receiver: it dials out to the `ws_url` provided in
 * the query string, authenticates with a token, and then drives the shared
 * `MolvisApp`. Communication is JSON-RPC 2.0 with binary-buffer framing.
 *
 * Handshake:
 *   client → server  {type:"hello", token, session}
 *   server → client  {type:"ready"}              (success)
 *                    ws.close(1008, "auth")       (token mismatch)
 *
 * Inbound: JSON-RPC requests are routed to `StandaloneRpcRouter`. Responses
 * (including those carrying binary buffers) flow back over the same socket.
 *
 * Outbound events: core events (selection-change, mode-change, …) are
 * pushed as JSON-RPC notifications (no `id`) via `sendEvent`.
 */

import type { Molvis } from "@molvis/core";
import { StandaloneRpcRouter } from "./rpc/router";
import type { RpcResponseEnvelope } from "./rpc/types";

/**
 * Decode a binary WebSocket frame into a JSON object + DataView buffers.
 *
 * Wire format:
 *   [4 bytes]  uint32 LE  buffer_count (N)
 *   [N*8 bytes] N pairs of (uint32 LE offset, uint32 LE length)
 *   [variable]  JSON payload (UTF-8)
 *   [variable]  concatenated buffer bytes
 */
function decodeBinaryFrame(data: ArrayBuffer): {
  json: Record<string, unknown>;
  buffers: DataView[];
} {
  const view = new DataView(data);
  let pos = 0;

  const bufferCount = view.getUint32(pos, true);
  pos += 4;

  const offsetTable: Array<{ offset: number; length: number }> = [];
  for (let i = 0; i < bufferCount; i++) {
    const offset = view.getUint32(pos, true);
    pos += 4;
    const length = view.getUint32(pos, true);
    pos += 4;
    offsetTable.push({ offset, length });
  }

  const headerSize = 4 + bufferCount * 8;
  const totalBufferSize = offsetTable.reduce((sum, e) => sum + e.length, 0);
  const jsonEnd = data.byteLength - totalBufferSize;
  const jsonBytes = new Uint8Array(data, headerSize, jsonEnd - headerSize);
  const jsonText = new TextDecoder().decode(jsonBytes);
  const json = JSON.parse(jsonText) as Record<string, unknown>;

  const bufferDataStart = jsonEnd;
  const buffers: DataView[] = [];
  for (const { offset, length } of offsetTable) {
    buffers.push(new DataView(data, bufferDataStart + offset, length));
  }

  return { json, buffers };
}

/**
 * Encode a JSON-RPC response into the binary wire format.
 * Used when the response carries binary buffers (e.g. snapshot).
 */
function encodeBinaryFrame(
  json: Record<string, unknown>,
  buffers: ArrayBuffer[],
): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const bufferCount = buffers.length;

  let totalBufferSize = 0;
  const offsets: Array<{ offset: number; length: number }> = [];
  for (const buf of buffers) {
    offsets.push({ offset: totalBufferSize, length: buf.byteLength });
    totalBufferSize += buf.byteLength;
  }

  const headerSize = 4 + bufferCount * 8;
  const totalSize = headerSize + jsonBytes.byteLength + totalBufferSize;
  const out = new ArrayBuffer(totalSize);
  const outView = new DataView(out);
  const outBytes = new Uint8Array(out);
  let pos = 0;

  outView.setUint32(pos, bufferCount, true);
  pos += 4;

  for (const { offset, length } of offsets) {
    outView.setUint32(pos, offset, true);
    pos += 4;
    outView.setUint32(pos, length, true);
    pos += 4;
  }

  outBytes.set(jsonBytes, pos);
  pos += jsonBytes.byteLength;

  for (const buf of buffers) {
    outBytes.set(new Uint8Array(buf), pos);
    pos += buf.byteLength;
  }

  return out;
}

export interface BridgeConnectResult {
  readonly session: string;
}

export class WebSocketBridge {
  private ws: WebSocket | null = null;
  private pendingWs: WebSocket | null = null;
  private router: StandaloneRpcRouter;
  private cleanupBeforeUnload: (() => void) | null = null;
  private ready = false;

  constructor(private readonly app: Molvis) {
    this.router = new StandaloneRpcRouter(app);
  }

  /**
   * Dial the given `ws_url` and perform the token handshake.
   *
   * Resolves once the server has sent `{type:"ready"}`; rejects if the
   * socket closes or errors before ready arrives.
   */
  connect(
    url: string,
    token: string,
    session: string,
  ): Promise<BridgeConnectResult> {
    return new Promise<BridgeConnectResult>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      // Track the in-flight socket so disconnect() can close it before
      // ready arrives (e.g. React StrictMode unmount during dev).
      this.pendingWs = ws;

      const preReadyHandler = (event: MessageEvent) => {
        if (typeof event.data !== "string") {
          return;
        }
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.type === "ready") {
          ws.removeEventListener("message", preReadyHandler);
          ws.addEventListener("message", (e) => {
            void this.handleMessage(e);
          });
          this.ws = ws;
          this.pendingWs = null;
          this.ready = true;
          settle(() => resolve({ session }));
        }
      };
      ws.addEventListener("message", preReadyHandler);

      ws.addEventListener("close", (event) => {
        if (this.pendingWs === ws) this.pendingWs = null;
        if (this.ws === ws) this.ws = null;
        this.ready = false;
        this.cleanupBeforeUnload?.();
        this.cleanupBeforeUnload = null;
        settle(() =>
          reject(
            new Error(
              `WebSocket closed before ready (code ${event.code}${
                event.reason ? `, ${event.reason}` : ""
              })`,
            ),
          ),
        );
      });

      ws.addEventListener("error", () => {
        settle(() => reject(new Error(`WebSocket connection failed: ${url}`)));
      });

      ws.addEventListener("open", () => {
        const onBeforeUnload = () => {
          ws.close(1000, "tab_closed");
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        this.cleanupBeforeUnload = () => {
          window.removeEventListener("beforeunload", onBeforeUnload);
        };

        ws.send(JSON.stringify({ type: "hello", token, session }));
      });
    });
  }

  disconnect(): void {
    this.cleanupBeforeUnload?.();
    this.cleanupBeforeUnload = null;

    // Close any in-flight pre-ready socket too — otherwise React
    // StrictMode (or a re-rendered cell) can leak a dangling WebSocket
    // that races the new bridge into the server's "session already bound"
    // path, surfacing as a BrokenPipe during handshake.
    if (this.pendingWs && this.pendingWs !== this.ws) {
      try {
        this.pendingWs.close(1000, "client_disconnect");
      } catch {
        /* socket already closed */
      }
      this.pendingWs = null;
    }

    if (this.ws) {
      this.ws.close(1000, "client_disconnect");
      this.ws = null;
    }
    this.ready = false;
  }

  /**
   * Send a JSON-RPC notification (no `id`, no response expected).
   *
   * Used by `EventForwarder` to push frontend events to the controller.
   * Silently no-ops if the socket is not ready.
   */
  sendEvent(method: string, params: Record<string, unknown>): void {
    if (!this.ws || !this.ready || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
      }),
    );
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    let request: Record<string, unknown>;
    let buffers: DataView[];

    if (event.data instanceof ArrayBuffer) {
      const decoded = decodeBinaryFrame(event.data);
      request = decoded.json;
      buffers = decoded.buffers;
    } else if (typeof event.data === "string") {
      request = JSON.parse(event.data) as Record<string, unknown>;
      buffers = [];
    } else {
      return;
    }

    // Ignore non-RPC control messages (e.g. future server-initiated pings).
    if (request.type !== undefined && request.jsonrpc === undefined) {
      return;
    }

    const response: RpcResponseEnvelope = await this.router.execute(
      request,
      buffers,
    );

    this.sendResponse(response);
  }

  private sendResponse(response: RpcResponseEnvelope): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (response.buffers && response.buffers.length > 0) {
      const frame = encodeBinaryFrame(
        response.content as unknown as Record<string, unknown>,
        response.buffers,
      );
      this.ws.send(frame);
    } else {
      this.ws.send(JSON.stringify(response.content));
    }
  }
}
