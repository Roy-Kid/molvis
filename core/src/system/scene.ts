import { Vector3 } from '@babylonjs/core';
import type { IProp } from './base';
import { Atom, Bond } from './item';

// Pure TS Scene: manages Atoms and Bonds without wasm
export class Scene {
  private static _instance: Scene | undefined;
  static instance(): Scene {
    if (!this._instance) this._instance = new Scene();
    return this._instance;
  }
  static withDefaultBox(): Scene { return new Scene(); }

  private _atoms = new Set<Atom>();
  private _bonds: Bond[] = [];

  addAtom(xyz: Vector3 = new Vector3(0, 0, 0)): Atom {
    const atom = new Atom(xyz);
    this._atoms.add(atom);
    return atom;
  }

  addBond(itom: Atom, jtom: Atom, props: Record<string, IProp> = {}): Bond {
    if (!this._atoms.has(itom) || !this._atoms.has(jtom)) {
      throw new Error('Both atoms must belong to the scene before bonding');
    }
    const existing = this._bonds.find(b => (b.itom === itom && b.jtom === jtom) || (b.itom === jtom && b.jtom === itom));
    if (existing) return existing;
    const bond = new Bond(itom, jtom, props);
    this._bonds.push(bond);
    return bond;
  }

  hasBond(itom: Atom, jtom: Atom): boolean {
    return this._bonds.some(b => (b.itom === itom && b.jtom === jtom) || (b.itom === jtom && b.jtom === itom));
  }

  removeAtom(atom: Atom): void {
    if (!this._atoms.has(atom)) return;
    this._bonds = this._bonds.filter(b => b.itom !== atom && b.jtom !== atom);
    this._atoms.delete(atom);
  }

  removeBond(bond: Bond): void {
    const idx = this._bonds.indexOf(bond);
    if (idx >= 0) this._bonds.splice(idx, 1);
  }

  getAtoms(): Atom[] { return Array.from(this._atoms.values()); }
  getBonds(): Bond[] { return this._bonds.slice(); }
}
