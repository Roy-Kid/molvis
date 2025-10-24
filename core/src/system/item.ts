import { Vector3 } from "@babylonjs/core";
import type { IProp } from "./base";

// Atom only contains xyz; no id and no metadata
export class Atom {
  xyz: Vector3;

  constructor(xyz: Vector3) {
    this.xyz = xyz.clone();
  }

  toJSON(): { x: number; y: number; z: number } {
    return { x: this.xyz.x, y: this.xyz.y, z: this.xyz.z };
  }
}

export class Bond {
  private _itom: Atom;
  private _jtom: Atom;
  private metadata: Record<string, IProp>;

  constructor(itom: Atom, jtom: Atom, metadata: Record<string, IProp> = {}) {
    this._itom = itom;
    this._jtom = jtom;
    this.metadata = { ...metadata };
  }

  get itom(): Atom { return this._itom; }
  get jtom(): Atom { return this._jtom; }
  get name(): string { return (this.metadata["name"] as string) ?? ""; }
  get order(): number { return (this.metadata["order"] as number) ?? 1; }
  get(key: string): IProp | undefined { return this.metadata[key]; }
  toJSON(): Record<string, IProp> { return { ...this.metadata }; }
  updateProperty(key: string, value: IProp): Bond { return new Bond(this._itom, this._jtom, { ...this.metadata, [key]: value }); }
}
