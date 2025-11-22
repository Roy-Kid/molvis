import { createLogger } from "../utils/logger";
import "./draw";
import "./select";
import type { MolvisApp as Molvis } from "../core/app";
import type { ArtistBase } from "../artist/base";
import { registerArtistDecoratedCommands } from "../artist/base";
import {
  applyStaticCommands,
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

    if (!ownerCandidate || typeof ownerCandidate !== "object" && typeof ownerCandidate !== "function") {
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
  private readonly artists = new Map<string, ArtistBase>();
  private readonly artistCommandKeys = new Map<string, string[]>();

  constructor(private readonly _app: Molvis) {
    applyStaticCommands(this.router);
    this.registerCoreNamespaces();
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

  registerArtist(name: string, artist: ArtistBase): void {
    if (!name) {
      throw new Error("Artist name must be provided.");
    }
    if (this.artists.has(name)) {
      this.unregisterArtist(name);
    }

    registerArtistDecoratedCommands(artist);
    this.artists.set(name, artist);

    const registeredCommands: string[] = [];
    for (const op of artist.listOps()) {
      const commandName = `artist.${name}.${op}`;
      this.router.registerCommand(commandName, (_ctx, commandPayload) =>
        artist.invoke(op, commandPayload),
      );
      registeredCommands.push(commandName);
    }

    this.artistCommandKeys.set(name, registeredCommands);
    this.log.info(`Registered artist "${name}" with ${registeredCommands.length} operations.`);
  }

  unregisterArtist(name: string): void {
    const registered = this.artistCommandKeys.get(name);
    if (registered) {
      for (const cmd of registered) {
        this.router.removeCommand(cmd);
      }
    }
    this.artistCommandKeys.delete(name);
    this.artists.delete(name);
  }

  getArtist(name: string): ArtistBase | undefined {
    return this.artists.get(name);
  }

  listArtists(): string[] {
    return Array.from(this.artists.keys()).sort();
  }

  private registerCoreNamespaces(): void {
    this.router.registerNamespace("app", createObjectNamespace("app", (ctx) => ctx.app));
    this.router.registerNamespace("world", createObjectNamespace("world", (ctx) => ctx.app.world));
    this.router.registerNamespace("mode", createObjectNamespace("mode", (ctx) => ctx.app.mode));
    this.router.registerNamespace("gui", createObjectNamespace("gui", (ctx) => ctx.app.gui));
    this.router.registerNamespace("artist", this.createArtistNamespace());
  }

  private createArtistNamespace(): CommandNamespaceHandler {
    return (path, _ctx, payload) => {
      if (path.length === 0) {
        throw new Error("Artist command requires an artist name.");
      }

      const [artistName, opName] = path;
      if (!artistName) {
        throw new Error("Artist name must be provided.");
      }

      const artist = this.getArtist(artistName);
      if (!artist) {
        throw new Error(`Unknown artist "${artistName}".`);
      }

      if (!opName) {
        throw new Error(`Artist command for "${artistName}" requires an operation name.`);
      }

      return artist.invoke(opName, payload);
    };
  }
}

export { Executor };
