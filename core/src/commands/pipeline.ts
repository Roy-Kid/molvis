import type {
  DataOp,
  DataOpContext,
  DataPipelineContext,
  FrameSource,
  RenderOp,
  RenderOpContext,
  RenderPipelineContext,
} from "./types";
import type { Frame } from "../structure/frame";
import type { Scene } from "@babylonjs/core";
import type { World } from "../core/world";

/**
 * DataPipeline manages a sequence of DataOps that transform Frame objects.
 * Internal implementation detail - not part of public API.
 */
export class DataPipeline {
  private _ops: DataOp[] = [];
  private _source: FrameSource | null = null;

  get source(): FrameSource | null {
    return this._source;
  }

  set source(source: FrameSource | null) {
    this._source = source;
  }

  get ops(): readonly DataOp[] {
    return this._ops;
  }

  appendOp(op: DataOp): void {
    this._ops.push(op);
  }

  insertOp(index: number, op: DataOp): void {
    if (index < 0 || index > this._ops.length) {
      throw new Error(`Index ${index} out of range [0, ${this._ops.length}]`);
    }
    this._ops.splice(index, 0, op);
  }

  replaceOp(id: string, op: DataOp): void {
    const index = this._ops.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Operation with id "${id}" not found`);
    }
    this._ops[index] = op;
  }

  removeOp(id: string): void {
    const index = this._ops.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Operation with id "${id}" not found`);
    }
    this._ops.splice(index, 1);
  }

  async compute(frameIndex: number, ctx: DataPipelineContext): Promise<Frame> {
    const source = this._source || ctx.source;
    if (!source) {
      throw new Error("No frame source available. Set pipeline.source or provide source in context.");
    }

    let frame = await source.getFrame(frameIndex);

    const opContext: DataOpContext = {
      frameIndex,
      source,
    };

    for (const op of this._ops) {
      if (op.enabled) {
        frame = op.apply(frame, opContext);
      }
    }

    return frame;
  }

  clear(): void {
    this._ops = [];
  }

  getOp(id: string): DataOp | undefined {
    return this._ops.find((op) => op.id === id);
  }
}

/**
 * RenderPipeline manages a sequence of RenderOps that render Frame objects to the scene.
 * Internal implementation detail - not part of public API.
 */
export class RenderPipeline {
  private _ops: RenderOp[] = [];
  private _scene: Scene | null = null;
  private _world: World | null = null;

  get scene(): Scene | null {
    return this._scene;
  }

  set scene(scene: Scene | null) {
    this._scene = scene;
  }

  get world(): World | null {
    return this._world;
  }

  set world(world: World | null) {
    this._world = world;
  }

  get ops(): readonly RenderOp[] {
    return this._ops;
  }

  appendOp(op: RenderOp): void {
    this._ops.push(op);
  }

  insertOp(index: number, op: RenderOp): void {
    if (index < 0 || index > this._ops.length) {
      throw new Error(`Index ${index} out of range [0, ${this._ops.length}]`);
    }
    this._ops.splice(index, 0, op);
  }

  replaceOp(id: string, op: RenderOp): void {
    const index = this._ops.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Operation with id "${id}" not found`);
    }
    this._ops[index] = op;
  }

  removeOp(id: string): void {
    const index = this._ops.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Operation with id "${id}" not found`);
    }
    this._ops.splice(index, 1);
  }

  render(frame: Frame, ctx: RenderPipelineContext): void {
    const scene = this._scene || ctx.scene;
    const world = this._world || ctx.world;

    if (!scene) {
      throw new Error("No scene available. Set pipeline.scene or provide scene in context.");
    }
    if (!world) {
      throw new Error("No world available. Set pipeline.world or provide world in context.");
    }

    const opContext: RenderOpContext = {
      scene,
      world,
    };

    for (const op of this._ops) {
      if (op.enabled) {
        op.render(scene, frame, opContext);
      }
    }
  }

  clear(): void {
    this._ops = [];
  }

  getOp(id: string): RenderOp | undefined {
    return this._ops.find((op) => op.id === id);
  }
}

