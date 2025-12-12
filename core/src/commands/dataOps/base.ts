import type { DataOp, DataOpContext } from "../types";
import type { Frame } from "../../structure/frame";

/**
 * Base class for DataOp implementations.
 * Provides common functionality like id generation, enabled flag, and serialization.
 */
export abstract class BaseDataOp implements DataOp {
  public readonly id: string;
  public enabled: boolean;

  constructor(id?: string) {
    this.id = id || this.generateId();
    this.enabled = true;
  }

  protected generateId(): string {
    return `${this.constructor.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  abstract apply(frame: Frame, ctx: DataOpContext): Frame;

  toJSON(): Record<string, unknown> {
    return {
      type: this.constructor.name,
      id: this.id,
      enabled: this.enabled,
    };
  }

  static fromJSON(_data: Record<string, unknown>): BaseDataOp {
    throw new Error("fromJSON must be implemented by subclass");
  }
}

