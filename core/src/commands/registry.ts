import type { MolvisApp } from "../core/app";

/**
 * Command function type that operates on MolvisApp.
 * Commands can be synchronous or asynchronous.
 */
export type CommandFn<A = any> = (app: MolvisApp, args: A) => void | Promise<void>;

/**
 * CommandRegistry manages command registration and execution.
 * 
 * Commands are functions that operate on MolvisApp and modify pipelines or app state.
 * They should NOT implicitly compute or render - those steps are triggered explicitly by the caller.
 */
export class CommandRegistry {
  private commands = new Map<string, CommandFn>();

  /**
   * Register a command function.
   * @param name Command name
   * @param fn Command function
   */
  register<A>(name: string, fn: CommandFn<A>): CommandFn<A> {
    if (!name || typeof name !== "string") {
      throw new Error("Command name must be a non-empty string");
    }
    if (typeof fn !== "function") {
      throw new Error("Command must be a function");
    }
    this.commands.set(name, fn as CommandFn);
    return fn;
  }

  /**
   * Execute a command by name.
   * @param name Command name
   * @param app MolvisApp instance
   * @param args Command arguments
   * @returns Promise if command is async, void otherwise
   */
  execute<A>(name: string, app: MolvisApp, args: A): void | Promise<void> {
    const fn = this.commands.get(name);
    if (!fn) {
      throw new Error(`Unknown command: ${name}`);
    }
    return fn(app, args);
  }

  /**
   * Check if a command is registered.
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered command names.
   */
  list(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  /**
   * Remove a command.
   */
  unregister(name: string): void {
    this.commands.delete(name);
  }
}

/**
 * Global commands singleton - the primary public API for command registration.
 */
export const commands = new CommandRegistry();
