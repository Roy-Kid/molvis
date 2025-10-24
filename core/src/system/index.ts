import { Atom, Bond } from "./item";
import { Scene } from "./scene";
import { Frame } from "./frame";
import { Trajectory } from "./trajectory";
import { Topology } from "./topology";
import { Vector3 } from "@babylonjs/core";
import type { IProp } from "./base";

class System {
  private _selected: Atom[] = [];
  private _atoms: Atom[] = [];
  private _bonds: Bond[] = [];
  private _universe: Scene;

  constructor() {
    this._universe = Scene.instance();
  }

  get scene(): Scene { return this._universe; }

  get atoms(): Atom[] { return this._atoms; }
  get bonds(): Bond[] { return this._bonds; }

  add_atom(_name: string, x: number, y: number, z: number, _props: Record<string, IProp> = {}): Atom {
    const atom = this._universe.addAtom(new Vector3(x, y, z));
    this._atoms.push(atom);
    return atom;
  }

  add_bond(itom: Atom, jtom: Atom, props: Record<string, IProp> = {}): Bond {
    const bond = this._universe.addBond(itom, jtom, props);
    this._bonds.push(bond);
    return bond;
  }

  remove_atom(atom: Atom) {
    this._atoms = this._atoms.filter(a => a !== atom);
    this._bonds = this._bonds.filter(b => b.itom !== atom && b.jtom !== atom);
    this._universe.removeAtom(atom);
  }

  clear() {
    this._atoms = [];
    this._bonds = [];
    // Recreate scene to ensure clean ECS state
    (this as any)._universe = Scene.instance();
  }

  public select_atom(atom: Atom) { this._selected.push(atom); }

  // Back-compat for UI indicators: single pseudo-frame
  public get current_frame_index(): number { return 0; }
  public get n_frames(): number { return 1; }
}

export { System, Atom, Bond, Scene, Topology, Frame, Trajectory };
export type { IProp };
