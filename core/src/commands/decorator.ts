import type { MolvisApp as Molvis } from "../core/app";

/**
 * Command function type - all commands must accept app as first parameter
 */
export type CommandFunction = (app: Molvis, ...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Command metadata stored for each registered command
 */
export interface CommandMetadata {
  fn: CommandFunction;
  paramNames: string[];
  name: string;
}

/**
 * Global registry of all registered commands
 */
const commandRegistry = new Map<string, CommandMetadata>();

/**
 * Extract parameter names from a function using its string representation
 */
function extractParamNames(fn: Function): string[] {
  const fnStr = fn.toString();
  const match = fnStr.match(/\(([^)]*)\)/);
  if (!match) return [];
  
  const params = match[1]
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      // Remove default values, type annotations, etc.
      return p.split(":")[0].split("=")[0].trim();
    });
  
  return params;
}

/**
 * Register a command function
 */
function registerCommand(name: string, fn: CommandFunction): void {
  if (!name || typeof name !== "string") {
    throw new Error("Command name must be a non-empty string");
  }
  if (typeof fn !== "function") {
    throw new Error("Command must be a function");
  }
  
  const paramNames = extractParamNames(fn);
  
  if (commandRegistry.has(name)) {
    console.warn(`Command "${name}" is already registered. Overwriting...`);
  }
  
  commandRegistry.set(name, {
    fn,
    paramNames,
    name,
  });
}

/**
 * Command decorator factory - can be used as a decorator on class methods or as a function call
 * 
 * @example
 * ```typescript
 * // As a decorator on class methods:
 * class Commands {
 *   @command("draw_atom")
 *   static drawAtom(app: Molvis, position: Vector3) { ... }
 * }
 * 
 * // As a function call for standalone functions (decorator-style registration):
 * export function draw_atom(app: Molvis, position: Vector3) { ... }
 * command("draw_atom")(draw_atom);
 * ```
 */
export function command(name: string) {
  return function <T extends CommandFunction>(
    target: T | (new (...args: unknown[]) => unknown) | object,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<T>
  ): T | void {
    // Used as a decorator on a method (instance or static)
    if (propertyKey !== undefined) {
      const originalMethod = descriptor?.value;
      if (originalMethod && typeof originalMethod === "function") {
        registerCommand(name, originalMethod as CommandFunction);
      }
      return;
    }
    
    // Used as a function call: command("name")(fn)
    if (typeof target === "function" && propertyKey === undefined && descriptor === undefined) {
      registerCommand(name, target as CommandFunction);
      return target;
    }
    
    throw new Error("Invalid usage of command decorator");
  } as any;
}

/**
 * Get all registered commands
 */
export function getRegisteredCommands(): Map<string, CommandMetadata> {
  return new Map(commandRegistry);
}

/**
 * Get metadata for a specific command
 */
export function getCommand(name: string): CommandMetadata | undefined {
  return commandRegistry.get(name);
}
