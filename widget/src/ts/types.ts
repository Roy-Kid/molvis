import type { AnyModel } from "@anywidget/types";

export interface WidgetModel {
  width: number;
  height: number;
  session_id: number;
}

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export type ModelType = AnyModel<WidgetModel>; 