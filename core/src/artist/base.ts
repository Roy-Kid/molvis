import type { Scene, Material, Mesh } from "@babylonjs/core";
import { VertexData } from "@babylonjs/core";
import { Logger, type ILogObj } from "tslog";
import { createLogger } from "../utils/logger";
import { defineCommand } from "../command/base";

export interface ArtistContext {
  scene: Scene;
  state: Record<string, unknown>;
  log: (level: "debug" | "info" | "warn" | "error", message: string, data?: unknown) => void;
}

export interface ArtistOp<In = unknown, Out = unknown> {
  name: string;
  version?: string;
  summary?: string;
  validate?: (input: In) => void | never;
  execute: (ctx: ArtistContext, input: In) => Out | Promise<Out>;
}

export interface ArtistCommandOptions<In = unknown> {
  name?: string;
  version?: string;
  summary?: string;
  validate?: (input: In) => void | never;
}

export type ArtistCommandMetadata = {
  methodName: string;
  name: string;
  version?: string;
  summary?: string;
  validate?: (input: unknown) => void | never;
};

type ArtistApiInvoker = (input?: unknown) => Promise<unknown>;

const COMMAND_METADATA_KEY = Symbol("molvis.artist.commandMeta");

interface ArtistCommandCarrier {
  [COMMAND_METADATA_KEY]?: ArtistCommandMetadata[];
}

export function ArtistCommand<In = unknown>(
  options: ArtistCommandOptions<In> = {},
): MethodDecorator {
  const registerMetadata = (carrier: ArtistCommandCarrier, methodName: string) => {
    const name = options.name ?? methodName;
    const inherited = carrier[COMMAND_METADATA_KEY];
    const current = inherited ? [...inherited] : [];

    // Avoid duplicating the same record
    const existingIndex = current.findIndex((item) => item.name === name && item.methodName === methodName);
    const record: ArtistCommandMetadata = {
      methodName,
      name,
      version: options.version,
      summary: options.summary,
      validate: options.validate as ((input: unknown) => void | never) | undefined,
    };

    if (existingIndex >= 0) {
      current[existingIndex] = record;
    } else {
      current.push(record);
    }

    Object.defineProperty(carrier, COMMAND_METADATA_KEY, {
      value: current,
      writable: true,
      configurable: true,
    });
  };

  return (target, propertyKey) => {
    // Stage 3 decorator semantics - target is the method, propertyKey is the context object
    if (propertyKey && typeof propertyKey === "object" && "kind" in propertyKey) {
      const context = propertyKey as ClassMethodDecoratorContext;
      if (context.kind !== "method" || typeof context.name !== "string") {
        throw new Error("ArtistCommand decorator can only be applied to string named methods.");
      }

      context.addInitializer(function initializer(this: unknown) {
        const carrier = (context.static ? this : Object.getPrototypeOf(this)) as ArtistCommandCarrier | null;
        if (!carrier) {
          return;
        }
        registerMetadata(carrier, context.name);
      });
      return target;
    }
  };
}

export abstract class ArtistBase {
  readonly id: string;
  readonly scene: Scene;
  protected readonly ops: Map<string, ArtistOp>;
  readonly ctx: ArtistContext;
  readonly api: Record<string, ArtistApiInvoker>;
  protected readonly logger: Logger<ILogObj>;
  private readonly materialPool = new Map<
    string,
    {
      material: Material;
      refCount: number;
    }
  >();
  private readonly geometryPool = new Map<
    string,
    {
      data: VertexData;
      refCount: number;
    }
  >();

  protected constructor(scene: Scene, id?: string) {
    this.scene = scene;
    this.id = id ?? ArtistBase.createId();
    this.ops = new Map<string, ArtistOp>();
    const state: Record<string, unknown> = {};

    this.logger = createLogger(`Artist:${this.id}`);

    this.ctx = {
      scene: this.scene,
      state,
      log: (level, message, data) => {
        const logTable = this.logger as unknown as Record<
          "debug" | "info" | "warn" | "error",
          (...args: unknown[]) => void
        >;
        const fn = logTable[level] ?? this.logger.info.bind(this.logger);
        if (data !== undefined) {
          fn.call(this.logger, message, data);
          return;
        }
        fn.call(this.logger, message);
      },
    };

    this.api = new Proxy<Record<string, ArtistApiInvoker>>(
      {},
      {
        get: (_target, prop: string | symbol) => {
          if (typeof prop !== "string") {
            return undefined;
          }
          if (prop === "then") {
            return undefined;
          }
          return (input?: unknown) => this.invoke(prop, input);
        },
      },
    );

    registerArtistDecoratedCommands(this);
  }

  // Lifecycle hooks – subclasses can override as needed.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async init(): Promise<void> { }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async clear(): Promise<void> { }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async dispose(): Promise<void> { }

  protected registerOp<In, Out>(op: ArtistOp<In, Out>): void {
    if (this.ops.has(op.name)) {
      this.logger.warn(
        `Operation "${op.name}" is already registered on artist "${this.id}". Overriding previous handler.`,
      );
    }
    this.ops.set(op.name, op);
  }

  hasOp(name: string): boolean {
    return this.ops.has(name);
  }

  listOps(): string[] {
    return Array.from(this.ops.keys());
  }

  getOp(name: string): ArtistOp | undefined {
    return this.ops.get(name);
  }

  async invoke<In = unknown, Out = unknown>(name: string, input?: In): Promise<Out> {
    const op = this.ops.get(name);

    if (!op) {
      const available = this.listOps();
      const hint = available.length > 0 ? ` Available ops: ${available.join(", ")}` : "";
      throw new Error(`Unknown artist operation "${name}".${hint}`);
    }

    if (op.validate) {
      op.validate(input as In);
    }

    return await Promise.resolve(op.execute(this.ctx, input as In));
  }

  protected acquireMaterial<T extends Material>(key: string, factory: () => T): T {
    const entry = this.materialPool.get(key);
    if (entry) {
      entry.refCount += 1;
      return entry.material as T;
    }

    const material = factory();
    this.materialPool.set(key, { material, refCount: 1 });
    material.onDisposeObservable.add(() => {
      this.materialPool.delete(key);
    });
    return material;
  }

  protected releaseMaterial(key: string): void {
    const entry = this.materialPool.get(key);
    if (!entry) {
      return;
    }
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.material.dispose();
      this.materialPool.delete(key);
    }
  }

  protected acquireGeometry(key: string, factory: () => VertexData): VertexData {
    const entry = this.geometryPool.get(key);
    if (entry) {
      entry.refCount += 1;
      return entry.data;
    }

    const data = factory();
    this.geometryPool.set(key, { data, refCount: 1 });
    return data;
  }

  protected releaseGeometry(key: string): void {
    const entry = this.geometryPool.get(key);
    if (!entry) {
      return;
    }
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      this.geometryPool.delete(key);
    }
  }

  protected attachResourceTracking(mesh: Mesh, resources: { materialKey?: string; geometryKey?: string }): void {
    mesh.onDisposeObservable.add(() => {
      if (resources.materialKey) {
        this.releaseMaterial(resources.materialKey);
      }
      if (resources.geometryKey) {
        this.releaseGeometry(resources.geometryKey);
      }
    });
  }

  private static createId(): string {
    return `artist-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function collectArtistCommandMetadata(artist: ArtistBase): ArtistCommandMetadata[] {
  const seen = new Map<string, ArtistCommandMetadata>();
  let proto = Object.getPrototypeOf(artist) as (ArtistCommandCarrier & object) | null;

  while (proto && proto !== Object.prototype) {
    const metadata = (proto as ArtistCommandCarrier)[COMMAND_METADATA_KEY];
    if (metadata) {
      for (const record of metadata) {
        if (!seen.has(record.name)) {
          seen.set(record.name, record);
        }
      }
    }
    proto = Object.getPrototypeOf(proto) as (ArtistCommandCarrier & object) | null;
  }

  return Array.from(seen.values());
}

export function registerArtistDecoratedCommands(artist: ArtistBase): void {
  const metadata = collectArtistCommandMetadata(artist);
  const register = (artist as unknown as {
    registerOp: (op: ArtistOp) => void;
  }).registerOp.bind(artist as any);

  for (const record of metadata) {
    if (artist.hasOp(record.name)) {
      continue;
    }

    const method = (artist as Record<string, unknown>)[record.methodName];
    if (typeof method !== "function") {
      artist.ctx.log(
        "error",
        `Decorated command "${record.name}" references missing method "${record.methodName}".`,
      );
      continue;
    }

    const op: ArtistOp = {
      name: record.name,
      version: record.version,
      summary: record.summary,
      validate: record.validate as ((input: unknown) => void | never) | undefined,
      execute: async (_ctx: ArtistContext, payload: unknown) => {
        const result = (method as (input?: unknown, ctx?: ArtistContext) => unknown).call(
          artist,
          payload,
          artist.ctx,
        );
        return await Promise.resolve(result);
      },
    };

    register(op);
  }
}
