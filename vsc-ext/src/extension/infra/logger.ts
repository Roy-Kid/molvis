import * as vscode from "vscode";

export interface Logger {
  error(message: string): void;
}

export class VsCodeLogger implements Logger {
  public error(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}
