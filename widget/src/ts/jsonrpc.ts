import type { Molvis } from "@molvis/app";
import { Logger } from "tslog";
import { tableFromIPC } from "@apache-arrow/ts";
import type { JsonRPCRequest } from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";

const logger = new Logger({ name: "molvis-jsonrpc" });

type MolvisClass<T = unknown> = new (...args: unknown[]) => T;

function getattr<T extends object>(instance: T, name: keyof T) {
  return instance[name];
}

export class JsonRpcHandler {
  private app: Molvis;

  constructor(app: Molvis) {
    this.app = app;
  }

  public execute(request: JsonRPCRequest, buffers: DataView[] = []) {

    const { jsonrpc, method, params, id } = request;

    if (jsonrpc !== "2.0") {
      return createErrorResponse(id, -32600, "Invalid JSON-RPC version");
    }

    const processedParams = this.processBuffers(params, buffers);
    logger.info(`Executing method: ${method}`);
    const { context, methodName } = this.parseMethod(method);
    const response = this.callFunction(
      // @ts-ignore
      context,
      id,
      methodName,
      processedParams,
    );
    return response;
  }

  private processBuffers(
    params: { [key: string]: string },
    buffers: DataView[],
  ) {
    const tableData = new Map<string, unknown>();
    for (const [key, value] of Object.entries(params)) {
      tableData.set(key, value);
    }
    if (buffers.length > 0) {
      const table = tableFromIPC(buffers);
      const columns = table.schema.fields.map((field) => field.name);
      for (const column of columns) {
        const columnData = table.getChild(column);
        tableData.set(column, columnData);
      }
    }

    return tableData;
  }

  private parseMethod(method: string) {
    const parts = method.split(".");
    const methodName = parts.pop();
    if (!methodName) throw new Error("Invalid method format");
    let context = this.app;
    for (const part of parts) {
      // @ts-ignore
      context = getattr(this.app, part);
    }
    return { context, methodName };
  }

  private callFunction(
    context: MolvisClass,
    id: number | null,
    methodName: keyof MolvisClass,
    params: Map<string, unknown>,
  ) {
    try {
      const method = getattr(context, methodName);
      if (typeof method !== "function") {
        throw new Error(`Method ${String(methodName)} is not a function`);
      }
      // @ts-ignore
      const result = method(params);
      return createSuccessResponse(id, result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createErrorResponse(id, -32603, error.message);
      }
      throw new Error("An unknown error occurred");
    }
  }
}
