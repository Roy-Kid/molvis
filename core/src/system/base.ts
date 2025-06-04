import type { Vector3 } from "@babylonjs/core";

export type IProp = number | string | Vector3 | boolean;

export interface IEntity {
    get(key: string): IProp;
}

export class Entity<T = unknown> {
    protected readonly _data: Record<string, T>;
  
    constructor(data: Record<string, T>) {
      this._data = Object.freeze({ ...data });
    }
  
    public get(key: string): T {
      const val = this._data[key];
      return val;
    }
  
    public has(key: string): boolean {
      return key in this._data;
    }
  
    public keys(): string[] {
      return Object.keys(this._data);
    }
  
    public entries(): [string, T][] {
      return Object.entries(this._data);
    }
  
    public toJSON(): Record<string, T> {
      return { ...this._data };
    }
  
    /**
     * Immutable update: returns a new instance with updated key
     */
    public with(key: string, value: T): this {
      const newData = { ...this._data, [key]: value };
      return new (this.constructor as new (data: Record<string, T>) => this)(newData);
    }
  }
