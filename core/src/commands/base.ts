import type { MolvisApp as Molvis } from "../core/app";
import type { CommandFunction } from "./decorator";
import { getCommand } from "./decorator";

export type CommandPayload = unknown;
export type CommandResult = unknown;

export interface CommandRuntime {
  readonly app: Molvis;
}

export interface CommandExecutionContext {
  readonly app: Molvis;
  readonly runtime: CommandRuntime;
  readonly router: CommandRouter;
}

export type CommandNamespaceHandler = (
  path: string[],
  ctx: CommandExecutionContext,
  payload?: CommandPayload,
) => CommandResult | Promise<CommandResult>;

/**
 * Extract arguments from payload for a command function.
 * 
 * @param fn - The command function
 * @param app - The Molvis app instance
 * @param payload - The command payload
 * @param commandName - The command name (used to look up parameter names)
 * @returns Array of arguments to pass to the function
 */
function extractArgs(fn: CommandFunction, app: Molvis, payload: unknown, commandName?: string): unknown[] {
  const args = [app];
  
  if (payload === undefined || payload === null) {
    return args;
  }
  
  if (Array.isArray(payload)) {
    // Array payload: pass as positional arguments
    args.push(...payload);
  } else if (typeof payload === "object") {
    // Object payload: extract by parameter name
    let paramNames: string[] | undefined;
    
    if (commandName) {
      const cmdMeta = getCommand(commandName);
      paramNames = cmdMeta?.paramNames;
    }
    
    if (paramNames && paramNames.length > 1) {
      // Skip first parameter (app)
      for (let i = 1; i < paramNames.length; i++) {
        const paramName = paramNames[i];
        args.push((payload as Record<string, unknown>)[paramName]);
      }
    } else {
      // Fallback: try to extract common parameter names
      const payloadObj = payload as Record<string, unknown>;
      // Try common parameter names
      if ("box" in payloadObj) {
        args.push(payloadObj.box);
        if ("options" in payloadObj) args.push(payloadObj.options);
      } else if ("frame" in payloadObj || "frameData" in payloadObj) {
        args.push(payloadObj.frame || payloadObj.frameData);
        if ("options" in payloadObj) args.push(payloadObj.options);
      } else if ("mode" in payloadObj) {
        args.push(payloadObj.mode);
      } else if ("theme" in payloadObj) {
        args.push(payloadObj.theme);
      } else if ("size" in payloadObj) {
        args.push(payloadObj.size);
      } else if ("options" in payloadObj) {
        args.push(payloadObj.options);
      } else {
        // If no specific parameter found, pass the whole payload as second argument
        args.push(payload);
      }
    }
  } else {
    // Primitive value: pass as second argument
    args.push(payload);
  }
  
  return args;
}

export class CommandRouter {
  private readonly commands = new Map<string, CommandFunction>();
  private readonly namespaces = new Map<string, CommandNamespaceHandler>();

  registerCommand(name: string, handler: CommandFunction): void {
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

    // Try to find a registered command function
    const commandFn = this.commands.get(name);
    if (commandFn) {
      const args = extractArgs(commandFn, runtime.app, payload, name);
      return commandFn(...args) as CommandResult | Promise<CommandResult>;
    }

    // Try namespace handlers
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
