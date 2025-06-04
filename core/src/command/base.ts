import type { Molvis } from "@molvis/core";
import type { Mesh } from "@babylonjs/core";
import type { IEntity, IProp } from "../system/base";

const classRegistry = new Map<string, CommandConstructor>();
const registerCommand = (name: string) => {
  return (target: CommandConstructor) => {
    classRegistry.set(name, target);
  }
}

interface ICommand {
  
  do(args: Record<string, unknown>): [Mesh[], IEntity[]];
  undo(): void;
}

interface CommandConstructor {
  new(app: Molvis): ICommand;
}

export { registerCommand, classRegistry };
export type { CommandConstructor, ICommand };