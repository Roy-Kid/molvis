import type { AnyModel } from "@anywidget/types";

export interface WidgetModel {
  width: number;
  height: number;
  session_id: number;
}

export interface JsonRpcMessage {
  jsonrpc: string;
  method: string;
  params: any;
}

export type ModelType = AnyModel<WidgetModel>; 