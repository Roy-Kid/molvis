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
const commandMetadataRegistry = new Map<Function, CommandMetadata>();

import { commands } from "./registry";

/**
 * Decorator to expose a Command's do() method for RPC calls
 * Usage: @command("command_name")
 */
export function command(name: string) {
  return function <T extends { new(app: MolvisApp, args: any): Command }>(constructor: T) {
    // Register metadata
    commandMetadataRegistry.set(constructor, {
      name,
      rpcExposed: true,
    });

    // Register in global command registry
    commands.register(name, (app, args) => {
      const cmd = new constructor(app, args);
      return cmd.do();
    });

    return constructor;
  };
}

/**
 * Get command metadata for a command class
 */
export function getCommandMetadata(commandClass: Function): CommandMetadata | undefined {
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
export abstract class Command<TResult = any> {
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
