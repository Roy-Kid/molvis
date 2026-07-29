import type { SketchCommand } from "./sketch_command";

/**
 * Undo/redo stack for sketch commands.
 * Semantics mirror core CommandManager (execute clears redo) without importing core.
 */
export class SketchHistory {
  private undoStack: SketchCommand[] = [];
  private redoStack: SketchCommand[] = [];

  execute(cmd: SketchCommand): void {
    cmd.do();
    this.undoStack.push(cmd);
    this.redoStack.length = 0;
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.do();
    this.undoStack.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
