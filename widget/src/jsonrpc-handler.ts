import { Molvis } from "molvis";
import { Logger } from "tslog";
import { tableFromIPC } from 'apache-arrow';
const logger = new Logger({ name: "molvis-jsonrpc" });

export interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export class JsonRpcHandler {

  private context: Molvis | undefined;

  constructor(context: Molvis) {
    this.context = context;
  }

  public execute(request: JsonRpcRequest, buffers: DataView[] = []) {
      // params: object
    const { jsonrpc, method, params, id } = request;
    if (jsonrpc !== "2.0") {
      return this.createErrorResponse(id, -32600, "Invalid JSON-RPC version");
    }

    try {
      // Handle special cases with buffers
      const processedParams = this.processBuffers(method, params, buffers);
      
      const { context, methodName } = this.parseMethod(method);
      const func = this.getMethodFunction(context || this.context, methodName);
      const result = func(...Object.values(processedParams || {}));
      return this.createSuccessResponse(id, result);
    } catch (error: any) {
      logger.error(`error: ${error.message} from ${method}`);
      return this.createErrorResponse(id, -32603, error.message, error.stack);
    }
  }

  private processBuffers(method: string, params: any, buffers: DataView[]) {
    const processedParams = { ...params };
    
    if (buffers.length > 0) {

      buffers.forEach((buffer, idx) => {
        // Convert DataView to Uint8Array
        const uint8Buffer = new Uint8Array(buffer.buffer);
        
        // Create Arrow Table from buffer
        const table = tableFromIPC(uint8Buffer);
        
        // Convert table to object with column arrays
        // assume field of buffers is unique
        const tableData = new Map<string, any[]>();

        // Iterate over the columns of the table
        const columns = table.schema.fields;
        columns.forEach((column) => {
          const columnName = column.name;
          const columnValues = table.getChild(columnName);
          if (columnValues) {
            tableData.set(columnName, columnValues?.toArray());
          }
        });

        Object.assign(processedParams, tableData);
      });

      return processedParams;
    }
    
    return processedParams;
  }

  private parseMethod(method: string) {
    const parts = method.split(".");
    const methodName = parts.pop();
    if (!methodName) throw new Error("Invalid method format");

    const context = parts.length > 0
      ? parts.reduce((acc, part) => acc && (acc as any)?.[part], this.context)
      : null;

    return { context, methodName };
  }

  private getMethodFunction(context: any, methodName: string) {
    if (!context || typeof context[methodName] !== "function") {
      throw new Error(`Method ${methodName} not found or is not a function`);
    }
    return context[methodName].bind(context);
  }

  private createSuccessResponse(id: any, result: any): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      result,
      id: id || null,
    };
  }

  private createErrorResponse(
    id: any,
    code: number,
    message: string,
    data?: any
  ): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      error: { code, message, data },
      id: id || null,
    };
  }
} 