/**
 * WebSocket bridge connecting the page app to a Python MolVis server.
 *
 * Handles the binary wire format for transporting JSON-RPC messages
 * with binary buffer attachments (numpy arrays) over WebSocket.
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

export class WebSocketBridge {
  private ws: WebSocket | null = null;
  private router: StandaloneRpcRouter;
  private cleanupBeforeUnload: (() => void) | null = null;

  constructor(private readonly app: Molvis) {
    this.router = new StandaloneRpcRouter(app);
  }

  connect(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      // Attach message and close listeners before open fires
      ws.addEventListener("message", (event: MessageEvent) => {
        void this.handleMessage(event);
      });

      ws.addEventListener("close", () => {
        this.ws = null;
        this.cleanupBeforeUnload?.();
        this.cleanupBeforeUnload = null;
      });

      ws.addEventListener("error", () => {
        reject(new Error(`WebSocket connection failed: ${url}`));
      });

      ws.addEventListener("open", () => {
        this.ws = ws;

        // Clean disconnect on tab close
        const onBeforeUnload = () => {
          ws.close(1000, "tab_closed");
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        this.cleanupBeforeUnload = () => {
          window.removeEventListener("beforeunload", onBeforeUnload);
        };

        // Signal readiness to the Python server
        ws.send(JSON.stringify({ type: "ready", session: "standalone" }));

        resolve();
      });
    });
  }

  disconnect(): void {
    this.cleanupBeforeUnload?.();
    this.cleanupBeforeUnload = null;

    if (this.ws) {
      this.ws.close(1000, "client_disconnect");
      this.ws = null;
    }
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

    // Ignore non-RPC messages (e.g. ready ack from server)
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
