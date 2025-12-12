import type { RenderOp, RenderOpContext } from "../types";
import type { Scene } from "@babylonjs/core";
import type { Frame } from "../../structure/frame";

/**
 * Base class for RenderOp implementations.
 * Provides common functionality like id generation, enabled flag, and serialization.
 */
export abstract class BaseRenderOp implements RenderOp {
  public readonly id: string;
  public enabled: boolean;

  constructor(id?: string) {
    this.id = id || this.generateId();
    this.enabled = true;
  }

  protected generateId(): string {
    return `${this.constructor.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  abstract render(scene: Scene, frame: Frame, ctx: RenderOpContext): void;

  toJSON(): Record<string, unknown> {
    return {
      type: this.constructor.name,
      id: this.id,
      enabled: this.enabled,
    };
  }

  static fromJSON(_data: Record<string, unknown>): BaseRenderOp {
    throw new Error("fromJSON must be implemented by subclass");
  }
}

