import { System, World } from "@molvis/core";

const classRegistry = new Map<string, CommandConstructor>();
const registerCommand = (name: string) => {
  return (target: CommandConstructor) => {
    classRegistry.set(name, target);
  }
}

interface Command {
  execute(system: System, world: World): void;
}

interface CommandConstructor {
  new (...args: any[]): Command;
}

export { type Command, type CommandConstructor, registerCommand, classRegistry };