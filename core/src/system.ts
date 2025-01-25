import { Vector3 } from "@babylonjs/core";

class System {
  private _selected: Atom[];
  private _traj: Frame[];
  private _current_frame_index: number;

  constructor() {
    this._traj = [];
    this._current_frame_index = 0;
    this._selected = [];
  }

  public get current_frame(): Frame {
    if (this._traj.length === 0) {
      this.append_frame(new Frame());
    }
    return this._traj[this._current_frame_index];
  }

  public get traj(): Frame[] {
    return this._traj;
  }

  public set current_frame_index(idx: number) {
    this._current_frame_index = idx;
  }

  public get_frame(idx: number): Frame {
    return this._traj[idx];
  }

  public change_frame(idx: number) {
    this._current_frame_index = idx;
  }

  public next_frame() {
    this._current_frame_index += 1;
    if (this._current_frame_index >= this._traj.length) {
      this._current_frame_index = this._traj.length - 1;
    }
    return this.current_frame;
  }

  public prev_frame() {
    this._current_frame_index -= 1;
    if (this._current_frame_index < 0) {
      this._current_frame_index = 0;
    }
    return this.current_frame;
  }

  static random_atom_id(): string {
    const randomNum = Math.floor(Math.random() * 0x10000);

    const hexID = randomNum.toString(16).padStart(4, "0");

    return hexID;
  }

  public select_atom(atom: Atom) {
    this._selected.push(atom);
  }

  public append_frame(frame: Frame) {
    this._traj.push(frame);
  }
}

class Frame {
  private _atoms: Atom[];
  private _bonds: Bond[];
  private _props: Map<string, any>;

  constructor() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }
  
  public add_atom(arg: Atom | Map<string, any>): Atom {
    if (arg instanceof Atom) {
      this._atoms.push(arg);
      return arg;
    } else {
      const atom = new Atom(arg);
      this._atoms.push(atom);
      return atom;
    }
  }

  public add_bond = (
    itom: Atom,
    jtom: Atom,
    data: Map<string, any> = new Map()
  ): Bond => {
    const bond = new Bond(itom, jtom, data);
    this._bonds.push(bond);
    return bond;
  };

  public get_atom = (fn: (atom: Atom) => boolean): Atom | undefined => {
    return this._atoms.find(fn);
  };

  public get_bond = (fn: (bond: Bond) => boolean): Bond | undefined => {
    return this._bonds.find(fn);
  };

  get n_atoms(): number {
    return this._atoms.length;
  }

  get props(): Map<string, any> {
    return this._props;
  }

  get atoms(): Atom[] {
    return this._atoms;
  }

  get bonds(): Bond[] {
    return this._bonds;
  }

  public clear() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }
}

type AtomValue = number | string | Vector3 | Array<number> | boolean;

class Atom {
  private _data: Map<string, AtomValue> = new Map();

  constructor(data?: Map<string, AtomValue> | [string, AtomValue][]) {
    if (data) {
      if (data instanceof Map) {
        data.forEach((value, key) => this.set(key, value));
      } else {
        data.forEach(([key, value]) => this.set(key, value));
      }
    }
  }

  public set(key: string, value: AtomValue): void {
    this._data.set(key, value);
  }

  public get(key: string): AtomValue | undefined {
    return this._data.get(key);
  }

  public has(key: string): boolean {
    return this._data.has(key);
  }

  get name(): string {
    const name = this.get("name");
    return typeof name === "string" ? name : "";
  }

  get xyz(): Vector3 {
    const x = this.get("x");
    const y = this.get("y");
    const z = this.get("z");
    return new Vector3(
      typeof x === "number" ? x : 0,
      typeof y === "number" ? y : 0,
      typeof z === "number" ? z : 0
    );
  }

  set xyz(xyz: Vector3) {
    this.set("x", xyz.x);
    this.set("y", xyz.y);
    this.set("z", xyz.z);
  }
}

class Bond extends Map<string, any> {
  public itom: Atom;
  public jtom: Atom;

  constructor(itom: Atom, jtom: Atom, props: Map<string, any> = new Map()) {
    super(props);
    this.itom = itom;
    this.jtom = jtom;
  }

  get name(): string {
    return `${this.itom.name}-${this.jtom.name}`;
  }
}

export { System, Atom, Bond, Frame };
