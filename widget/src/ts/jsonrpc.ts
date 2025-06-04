import type { Molvis } from "@molvis/app";
import { Logger } from "tslog";
import { tableFromIPC, type Table } from "@apache-arrow/ts";
import type { JsonRPCRequest } from "./types";
import { createErrorResponse, createSuccessResponse } from "./types";

const logger = new Logger({ name: "molvis-jsonrpc" });

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
    const response = this.callFunction(
      id,
      method,
      // @ts-ignore
      processedParams,
    );
    return response;
  }

  private processBuffers(
    params: Record<string, string|number|Record<string, unknown>>,
    buffers: DataView[],
  ) {
    for (const key in params) {
      const value = params[key];
      if (typeof value === "string") {
        if (value.startsWith("__buffer")) {
          const index = value.split(".")[1];
          const buffer = buffers[Number.parseInt(index)];
   

          // parser arrow format into a object
          const table = tableFromIPC(buffer);
          const tableData = this.parseArrowTable(table);

          params[key] = tableData;
          
        }
      }
    }
    return params;
  }

  private parseArrowTable(table: Table) {
    const data: Record<string, unknown> = {};
    const columns = table.schema.fields.map((field) => field.name);
    for (const column of columns) {
      // const type = column.type;
      const values = table.getChild(column)?.toArray();
      // if (type === "string") {
      //   data[name] = values.map((v) => v.toString());
      // } else if (type === "number") {
      //   data[name] = values.map((v) => Number(v));
      // } else if (type === "boolean") {
      //   data[name] = values.map((v) => Boolean(v));
      // } else {
      //   data[name] = values;
      // }
      data[column] = Array.from(values);
    }
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
