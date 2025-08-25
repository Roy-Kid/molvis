import type { Molvis } from "@molvis/core";

const classRegistry = new Map<string, CommandConstructor>();
const registerCommand = (name: string) => {
  return (target: CommandConstructor) => {
    classRegistry.set(name, target);
  }
}

interface ICommand {
  // Return serializable status/result instead of Mesh objects
  do(args: Record<string, unknown>): {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
    count?: number;
  };
  undo(): void;
}

interface CommandConstructor {
  new(app: Molvis): ICommand;
}

export { registerCommand, classRegistry };
export type { CommandConstructor, ICommand };