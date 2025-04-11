import { Molvis } from "@molvis/core";
import type { Mesh } from "@babylonjs/core";
import { IEntity } from "../system/base";

const classRegistry = new Map<string, CommandConstructor>();
const registerCommand = (name: string) => {
  return (target: CommandConstructor) => {
    classRegistry.set(name, target);
  }
}

interface ICommand {
  
  do(app: Molvis): [Mesh[], IEntity[]];
  undo(app: Molvis): void;
}

interface CommandConstructor {
  new(...args: any[]): ICommand;
}

export { registerCommand, classRegistry };
export type { CommandConstructor, ICommand };