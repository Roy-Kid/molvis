import { Vector3 } from "@babylonjs/core";

class Trajectory {
  private _frames: Frame[] = [];
  private _currentIndex = 0;

  addFrame(frame: Frame) {
    this._frames.push(frame);
  }

  get currentFrame(): Frame {
    if (this._frames.length === 0) {
      this.addFrame(new Frame());
    }
    return this._frames[this._currentIndex];
  }

  get frames(): Frame[] {
    return this._frames;
  }

  get_frame(idx: number): Frame | undefined {
    return this._frames[idx];
  }

  set currentIndex(idx: number) {
    this._currentIndex = idx;
  }

  nextFrame() {
    this._currentIndex = Math.min(
      this._currentIndex + 1,
      this._frames.length - 1,
    );
    return this.currentFrame;
  }

  prevFrame() {
    this._currentIndex = Math.max(this._currentIndex - 1, 0);
    return this.currentFrame;
  }
}

class System {
  private _selected: Atom[];
  private _trajectory: Trajectory;

  constructor() {
    this._trajectory = new Trajectory();
    this._selected = [];
  }

  public get trajectory() {
    return this._trajectory;
  }

  public get current_frame() {
    return this._trajectory.currentFrame;
  }

  public set current_frame_index(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public get_frame(idx: number): Frame | undefined {
    return this._trajectory.get_frame(idx);
  }

  public change_frame(idx: number) {
    this._trajectory.currentIndex = idx;
  }

  public next_frame() {
    return this._trajectory.nextFrame();
  }

  public prev_frame() {
    return this._trajectory.prevFrame();
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
    this._trajectory.addFrame(frame);
  }

  get n_frames(): number {
    return this._trajectory.frames.length;
  }
}

class Frame {
  private _atoms: Atom[];
  private _bonds: Bond[];
  private _props: Map<string, ItemValue>;

  constructor() {
    this._atoms = [];
    this._bonds = [];
    this._props = new Map();
  }

  public add_atom(arg: Atom | Map<string, ItemValue>): Atom {
    if (arg instanceof Atom) {
      this._atoms.push(arg);
      return arg;
    }
    const atom = new Atom(arg);
    this._atoms.push(atom);
    return atom;
  }

  public add_bond = (
    itom: Atom,
    jtom: Atom,
    data: Map<string, ItemValue> = new Map(),
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

  get props(): Map<string, ItemValue> {
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

type ItemValue = number | string | Vector3 | Array<number> | boolean;

class Atom {
  private _data: Map<string, ItemValue> = new Map();

  constructor(data?: Map<string, ItemValue> | [string, ItemValue][]) {
    if (data) {
      if (data instanceof Map) {
        data.forEach((value, key) => this.set(key, value));
      } else {
        for (const [key, value] of data) {
          this.set(key, value);
        }
      }
    }
  }

  public set(key: string, value: ItemValue): void {
    this._data.set(key, value);
  }

  public get(key: string): ItemValue | undefined {
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
      typeof z === "number" ? z : 0,
    );
  }

  set xyz(xyz: Vector3) {
    this.set("x", xyz.x);
    this.set("y", xyz.y);
    this.set("z", xyz.z);
  }
}

class Bond extends Map<string, ItemValue> {
  public itom: Atom;
  public jtom: Atom;

  constructor(itom: Atom, jtom: Atom, props: Map<string, ItemValue> = new Map()) {
    super(props);
    this.itom = itom;
    this.jtom = jtom;
  }

  get name(): string {
    return `${this.itom.name}-${this.jtom.name}`;
  }
}

export { System, Atom, Bond, Frame, Trajectory };
export type { ItemValue };