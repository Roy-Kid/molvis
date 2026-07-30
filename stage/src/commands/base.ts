import type { MolvisApp } from "../app";

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
type CommandConstructor<A, R> = new (app: MolvisApp, args: A) => Command<R>;
type CommandClass = abstract new (...args: never[]) => Command<unknown>;
const commandMetadataRegistry = new Map<CommandClass, CommandMetadata>();

import { commands } from "./registry";

/**
 * Decorator to expose a Command's `do()` method for RPC/registry calls.
 * Usage: `@command("command_name")`
 *
 * EXECUTION-MODEL CONTRACT (read before assuming reversibility):
 * registry execution (`app.execute(name, args)` / RPC) runs `do()` and
 * **discards the instance — it is fire-and-forget and NEVER enters the undo
 * history.** This is intentional: RPC/registry commands are imperative
 * controller actions (e.g. `draw_frame`, `draw_box`) that must not pollute the
 * user's undo stack. Reversible *user* actions must instead be run through
 * `commandManager.execute(new SomeCommand(...))`, which retains the instance
 * and calls `undo()` on rollback. A command may implement `undo()` and still be
 * invoked through either path; the path — not the command — decides undoability.
 */
export function command(name: string) {
  return ((target) => {
    const commandClass = target as unknown as CommandClass;
    const ctor = target as unknown as CommandConstructor<unknown, unknown>;

    // Register metadata
    commandMetadataRegistry.set(commandClass, {
      name,
      rpcExposed: true,
    });

    // Register in global command registry
    commands.register(name, (app, args) => {
      const cmd = new ctor(app, args);
      return cmd.do();
    });
  }) satisfies ClassDecorator;
}

/**
 * Get command metadata for a command class
 */
export function getCommandMetadata(
  commandClass: CommandClass,
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
