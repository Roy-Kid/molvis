import type { AnyModel } from "@anywidget/types";

export interface WidgetModel {
  width: number;
  height: number;
  session_id: number;
}

export interface JsonRPCRequest {
  jsonrpc: "2.0";
  id: number | null;
  method: string;
  params: { [key: string]: string };
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result: { [key: string]: string } | null;
  error: {
    code: number;
    message: string;
    data: { [key: string]: string } | null;
  } | null;
}

export type ModelType = AnyModel<WidgetModel>;
