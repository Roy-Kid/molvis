import type { Molvis } from "../app";
import type { ArtistBase } from "../artist/base";

export type CommandPayload = unknown;
export type CommandResult = unknown;

export interface CommandRuntime {
  readonly app: Molvis;
  getArtist(name: string): ArtistBase | undefined;
  listArtists(): string[];
}

export interface CommandExecutionContext {
  readonly app: Molvis;
  readonly runtime: CommandRuntime;
  readonly router: CommandRouter;
}

export type CommandHandler = (
  ctx: CommandExecutionContext,
  payload?: CommandPayload,
) => CommandResult | Promise<CommandResult>;

export type CommandNamespaceHandler = (
  path: string[],
  ctx: CommandExecutionContext,
  payload?: CommandPayload,
) => CommandResult | Promise<CommandResult>;

export class CommandRouter {
  private readonly commands = new Map<string, CommandHandler>();
  private readonly namespaces = new Map<string, CommandNamespaceHandler>();

  registerCommand(name: string, handler: CommandHandler): void {
    if (!name || typeof name !== "string") {
      throw new Error("Command name must be a non-empty string.");
    }
    this.commands.set(name, handler);
  }

  removeCommand(name: string): void {
    this.commands.delete(name);
  }

  registerNamespace(prefix: string, handler: CommandNamespaceHandler): void {
    if (!prefix || typeof prefix !== "string") {
      throw new Error("Namespace prefix must be a non-empty string.");
    }
    this.namespaces.set(prefix, handler);
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  listCommands(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  listNamespaces(): string[] {
    return Array.from(this.namespaces.keys()).sort();
  }

  execute(
    runtime: CommandRuntime,
    name: string,
    payload?: CommandPayload,
  ): CommandResult | Promise<CommandResult> {
    if (!runtime || !runtime.app) {
      throw new Error("Command runtime is missing a valid application reference.");
    }
    if (!name) {
      throw new Error("Command name must be provided.");
    }

    const ctx: CommandExecutionContext = {
      app: runtime.app,
      runtime,
      router: this,
    };

    const direct = this.commands.get(name);
    if (direct) {
      return direct(ctx, payload);
    }

    const segments = name.split(".");
    if (segments.length > 1) {
      const [namespace, ...path] = segments;
      const nsHandler = this.namespaces.get(namespace);
      if (nsHandler) {
        return nsHandler(path, ctx, payload);
      }
    }

    throw new Error(`Unknown command "${name}".`);
  }
}

const staticCommands = new Map<string, CommandHandler>();

export function defineCommand(name: string, handler: CommandHandler): void {
  if (staticCommands.has(name)) {
    throw new Error(`Command "${name}" is already defined.`);
  }
  staticCommands.set(name, handler);
}

export function applyStaticCommands(router: CommandRouter): void {
  for (const [name, handler] of staticCommands.entries()) {
    router.registerCommand(name, handler);
  }
}
