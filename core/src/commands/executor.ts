import type { MolvisApp as Molvis } from "../core/app";
import type { CommandFunction } from "./decorator";
import { getRegisteredCommands } from "./decorator";
import { createLogger } from "../utils/logger";
import {
  CommandRouter,
  type CommandExecutionContext,
  type CommandNamespaceHandler,
  type CommandPayload,
  type CommandResult,
  type CommandRuntime,
} from "./base";

const toArguments = (payload: CommandPayload): unknown[] => {
  if (payload === undefined) {
    return [];
  }
  return Array.isArray(payload) ? (payload as unknown[]) : [payload];
};

const resolveNestedProperty = (root: unknown, path: string[]): unknown => {
  let current = root;
  for (const segment of path) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
};

const createObjectNamespace = (
  namespace: string,
  resolver: (ctx: CommandExecutionContext) => unknown,
): CommandNamespaceHandler => {
  return (path, ctx, payload) => {
    if (path.length === 0) {
      throw new Error(`Command "${namespace}" requires a method name.`);
    }

    const targetRoot = resolver(ctx);
    if (!targetRoot) {
      throw new Error(`Namespace "${namespace}" is unavailable.`);
    }

    const methodName = path[path.length - 1];
    const ownerPath = path.slice(0, -1);
    const ownerCandidate = ownerPath.length
      ? resolveNestedProperty(targetRoot, ownerPath)
      : targetRoot;

    if (!ownerCandidate || (typeof ownerCandidate !== "object" && typeof ownerCandidate !== "function")) {
      throw new Error(`Cannot resolve target for "${namespace}.${path.join(".")}".`);
    }

    const method = (ownerCandidate as Record<string, unknown>)[methodName];
    if (typeof method !== "function") {
      throw new Error(
        `Method "${namespace}.${path.join(".")}" is not callable.`,
      );
    }

    return method.apply(ownerCandidate, toArguments(payload));
  };
};

class Executor implements CommandRuntime {
  private readonly log = createLogger("molvis.command.executor");
  private readonly router = new CommandRouter();

  constructor(private readonly _app: Molvis) {
    this.registerDecoratedCommands();
    this.registerCoreNamespaces();
  }

  private registerDecoratedCommands(): void {
    const commands = getRegisteredCommands();
    for (const [name, metadata] of commands.entries()) {
      this.router.registerCommand(name, metadata.fn);
      this.log.debug(`Registered command "${name}" from decorator`);
    }
  }

  get app(): Molvis {
    return this._app;
  }

  execute(command: string, payload: CommandPayload = {}): CommandResult | Promise<CommandResult> {
    this.log.debug("Executing command", { command, payload });
    return this.router.execute(this, command, payload);
  }

  list(): string[] {
    const names = new Set<string>(this.router.listCommands());
    for (const ns of this.router.listNamespaces()) {
      names.add(`${ns}.*`);
    }
    return Array.from(names).sort();
  }

  private registerCoreNamespaces(): void {
    this.router.registerNamespace("app", createObjectNamespace("app", (ctx) => ctx.app));
    this.router.registerNamespace("world", createObjectNamespace("world", (ctx) => ctx.app.world));
    this.router.registerNamespace("mode", createObjectNamespace("mode", (ctx) => ctx.app.mode));
    this.router.registerNamespace("gui", createObjectNamespace("gui", (ctx) => ctx.app.gui));
  }
}

export { Executor };
