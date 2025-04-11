import { Vector3 } from "@babylonjs/core";
import type { IEntity, Prop } from "./base";

class Atom implements IEntity {
  public _data: Map<string, Prop> = new Map();

  constructor() { }

  public get(key: string): Prop {
    const p = this._data.get(key);
    if (p === undefined) {
      throw new Error(`Property ${key} not found`);
    }
    return p;
  }

  public set(key: string, value: Prop): void {
    this._data.set(key, value);
  }

  get name(): string {
    return this._data.get("name") as string;
  }

  get xyz(): Vector3 {
    return this._data.get("xyz") as Vector3;
  }
}

class Bond extends Map<string, Prop> {
  public itom: Atom;
  public jtom: Atom;

  constructor(itom: Atom, jtom: Atom, props: Map<string, Prop> = new Map()) {
    super(props);
    this.itom = itom;
    this.jtom = jtom;
  }

  get name(): string {
    return `${this.itom.name}-${this.jtom.name}`;
  }
}

export { Atom, Bond };
export type { Prop };