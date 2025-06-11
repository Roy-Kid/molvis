import type { Molvis } from "@molvis/app";
import { Logger } from "tslog";
import h5wasm from "h5wasm";
import type { JsonRPCRequest } from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";

const logger = new Logger({ name: "molvis-jsonrpc" });

export class JsonRpcHandler {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public async execute(request: JsonRPCRequest, buffers: DataView[] = []) {
    const { jsonrpc, method, params, id } = request;

    if (jsonrpc !== "2.0") {
      return createErrorResponse(id, -32600, "Invalid JSON-RPC version");
    }

    const processedParams = await this.processBuffers(params, buffers);
    const response = this.callFunction(
      id,
      method,
      // @ts-ignore
      processedParams,
    );
    return response;
  }

  private async processBuffers(
    params: Record<string, string | number | Record<string, unknown>>,
    buffers: DataView[],
  ) {
    for (const key in params) {
      const value = params[key];
      if (typeof value === "string" && value.startsWith("__buffer")) {
        const index = value.split(".")[1];
        const buffer = buffers[Number.parseInt(index)];

        const tableData = await this.parseHdf5Buffer(buffer);
        params[key] = tableData;
      }
    }
    return params;
  }

  private async parseHdf5Buffer(buffer: DataView) {
    const { FS } = await h5wasm.ready;
    const path = `/tmp-${Date.now()}-${Math.random()}.h5`;
    FS.writeFile(path, new Uint8Array(buffer.buffer));
    const file = new h5wasm.File(path, "r");
    const data: Record<string, unknown> = {};
    for (const name of file.keys()) {
      const dset = file.get(name);
      // @ts-ignore value exists when dataset
      data[name] = Array.from(dset.value);
    }
    file.close();
    FS.unlink(path);
    return data;
  }

  private callFunction(
    id: number | null,
    method: string,
    params: Record<string, unknown>,
  ) {
    const result = this.app.execute(method, params);
    return createSuccessResponse(id, result);
  }
}
