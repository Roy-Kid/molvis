import type { MolvisApp } from "../app";
import { createLogger } from "../utils/logger";
import type { Command } from "./base";

/**
 * CommandManager handles the execution and undo/redo history of commands.
 */
export class CommandManager {
  private app: MolvisApp;
  private undoStack: Command<unknown>[] = [];
  private redoStack: Command<unknown>[] = [];
  private logger = createLogger("CommandManager");

  constructor(app: MolvisApp) {
    this.app = app;
  }

  /**
   * Execute a command and push it to the undo stack.
   * Clears the redo stack.
   */
  public async execute<T>(command: Command<T>): Promise<T> {
    this.logger.debug(`Executing command: ${command.constructor.name}`);
    const result = await command.do();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action
    this.emitHistoryChange();
    return result;
  }

  /**
   * Undo the last executed command.
   */
  public async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) {
      this.logger.debug("Undo stack empty");
      return false;
    }

    const command = this.undoStack.pop();
    if (!command) return false;
    this.logger.debug(`Undoing command: ${command.constructor.name}`);
    await command.undo();
    this.redoStack.push(command);
    this.emitHistoryChange();
    return true;
  }

  /**
   * Redo the last undone command.
   */
  public async redo(): Promise<boolean> {
    if (this.redoStack.length === 0) {
      this.logger.debug("Redo stack empty");
      return false;
    }

    const command = this.redoStack.pop();
    if (!command) return false;
    this.logger.debug(`Redoing command: ${command.constructor.name}`);
    await command.do();
    this.undoStack.push(command);
    this.emitHistoryChange();
    return true;
  }

  /**
   * Clear the command history.
   */
  public clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.logger.debug("History cleared");
    this.emitHistoryChange();
  }

  private emitHistoryChange() {
    this.app.events.emit("history-change", {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }

  /**
   * Check if undo is available.
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available.
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
