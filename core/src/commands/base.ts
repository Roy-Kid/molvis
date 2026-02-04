import type { MolvisApp } from "../core/app";

/**
 * Metadata for RPC-exposed commands
 */
interface CommandMetadata {
  name: string;
  rpcExposed: boolean;
}

/**
 * Global registry for command metadata
 */
type CommandConstructor = new (app: MolvisApp, args: unknown) => Command;
const commandMetadataRegistry = new Map<CommandConstructor, CommandMetadata>();

import { commands } from "./registry";

/**
 * Decorator to expose a Command's do() method for RPC calls
 * Usage: @command("command_name")
 */
export function command(name: string) {
  return <T extends CommandConstructor>(ctor: T) => {
    // Register metadata
    commandMetadataRegistry.set(ctor, {
      name,
      rpcExposed: true,
    });

    // Register in global command registry
    commands.register(name, (app, args) => {
      const cmd = new ctor(app, args);
      return cmd.do();
    });

    return ctor;
  };
}

/**
 * Get command metadata for a command class
 */
export function getCommandMetadata(
  commandClass: CommandConstructor,
): CommandMetadata | undefined {
  return commandMetadataRegistry.get(commandClass);
}

/**
 * Base class for all commands
 *
 * Commands encapsulate operations that can be executed, undone, and redone.
 * Each command must implement:
 * - do(): Execute the command and return a result
 * - undo(): Undo the command by executing its inverse operation
 *
 * Commands can be exposed for RPC using the @command decorator.
 * All commands MUST be located in core/src/commands/ directory.
 */
export abstract class Command<TResult = unknown> {
  protected app: MolvisApp;

  constructor(app: MolvisApp) {
    this.app = app;
  }

  /**
   * Execute the command
   * @returns The result of the command execution
   */
  abstract do(): TResult | Promise<TResult>;

  /**
   * Undo the command by executing its inverse
   * @returns The inverse command that was executed
   */
  abstract undo(): Command | Promise<Command>;
}
